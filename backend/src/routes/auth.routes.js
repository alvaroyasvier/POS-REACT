// backend/src/routes/auth.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { logAction } from "../services/auditService.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ ERROR CRÍTICO: JWT_SECRET no definida en .env");
  throw new Error("JWT_SECRET no definida en .env");
}

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: "Demasiadas solicitudes, intente más tarde",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

async function getSecuritySettings() {
  try {
    const result = await pool.query(
      "SELECT settings FROM configuraciones WHERE id = 1",
    );
    if (result.rows.length) {
      const security = result.rows[0].settings?.security || {};
      return {
        maxAttempts: parseInt(security.maxLoginAttempts) || 5,
        lockoutMinutes: parseInt(security.lockoutMinutes) || 15,
      };
    }
  } catch (err) {
    console.error("Error obteniendo configuración seguridad:", err);
  }
  return { maxAttempts: 5, lockoutMinutes: 15 };
}

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email y contraseña requeridos" });
    }

    const result = await pool.query(
      `SELECT id, name, email, role, password_hash, is_active,
              two_factor_secret, two_factor_enabled, current_session_id,
              last_activity, login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email.toLowerCase()],
    );

    if (result.rows.length === 0) {
      await logAction("LOGIN_FAILED", null, req, {
        email,
        reason: "user_not_found",
      });
      return res
        .status(401)
        .json({ success: false, message: "Credenciales inválidas" });
    }

    const user = result.rows[0];
    const now = new Date();

    if (user.locked_until && new Date(user.locked_until) > now) {
      const lockRemainingSeconds = Math.ceil(
        (new Date(user.locked_until) - now) / 1000,
      );
      await logAction("LOGIN_FAILED", user.id, req, {
        reason: "account_locked",
      });
      return res.status(401).json({
        success: false,
        message: `Cuenta bloqueada. Intente de nuevo en ${Math.ceil(lockRemainingSeconds / 60)} minutos`,
        locked: true,
        lockRemainingSeconds,
      });
    }

    if (!user.is_active) {
      await logAction("LOGIN_FAILED", user.id, req, {
        reason: "user_inactive",
      });
      return res
        .status(401)
        .json({ success: false, message: "Usuario inactivo" });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    const { maxAttempts, lockoutMinutes } = await getSecuritySettings();

    if (!validPass) {
      const newAttempts = (user.login_attempts || 0) + 1;
      let lockedUntil = null;
      let remainingAttempts = maxAttempts - newAttempts;

      if (newAttempts >= maxAttempts) {
        lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
        remainingAttempts = 0;
      }

      await pool.query(
        `UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [newAttempts, lockedUntil, user.id],
      );

      await logAction("LOGIN_FAILED", user.id, req, {
        attempts: newAttempts,
        maxAttempts,
      });

      const response = {
        success: false,
        message: "Credenciales inválidas",
        remainingAttempts,
      };
      if (lockedUntil) {
        response.lockRemainingSeconds = Math.ceil((lockedUntil - now) / 1000);
      }
      return res.status(401).json(response);
    }

    await pool.query(
      `UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [user.id],
    );

    if (user.current_session_id) {
      await pool.query(
        `UPDATE users SET current_session_id = NULL, last_activity = NULL WHERE id = $1`,
        [user.id],
      );
    }

    if (user.two_factor_enabled && !twoFactorToken) {
      const tempToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          requires2FA: true,
        },
        JWT_SECRET,
        { expiresIn: "5m" },
      );
      return res.json({
        success: true,
        requires2FA: true,
        data: { email: user.email, userId: user.id, tempToken },
      });
    }

    if (user.two_factor_enabled && twoFactorToken) {
      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: twoFactorToken,
        window: 1,
      });
      if (!verified) {
        await logAction("LOGIN_FAILED", user.id, req, {
          reason: "invalid_2fa",
        });
        return res
          .status(401)
          .json({ success: false, message: "Código 2FA inválido" });
      }
    }

    const sessionId = uuidv4();
    await pool.query(
      `UPDATE users SET current_session_id = $1, last_activity = NOW() WHERE id = $2`,
      [sessionId, user.id],
    );

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, sessionId },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });

    await logAction("LOGIN_SUCCESS", user.id, req, {
      email: user.email,
      role: user.role,
    });

    res.json({
      success: true,
      message: "Login exitoso",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          twoFactorEnabled: user.two_factor_enabled || false,
        },
      },
    });
  } catch (err) {
    console.error("Error en login:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.accessToken;
  if (!token)
    return res.status(401).json({ success: false, message: "No autorizado" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    await pool.query(
      `UPDATE users SET current_session_id = NULL, last_activity = NULL WHERE id = $1`,
      [decoded.userId],
    );
    res.clearCookie("accessToken", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ success: true, message: "Sesión cerrada correctamente" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al cerrar sesión" });
  }
});

router.post("/refresh", async (req, res) => {
  const oldToken = req.cookies?.accessToken;
  if (!oldToken)
    return res
      .status(401)
      .json({ success: false, message: "Token no encontrado" });
  try {
    const decoded = jwt.verify(oldToken, JWT_SECRET);
    const result = await pool.query(
      `SELECT current_session_id FROM users WHERE id = $1`,
      [decoded.userId],
    );
    if (
      result.rows.length === 0 ||
      result.rows[0].current_session_id !== decoded.sessionId
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Sesión inválida" });
    }
    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
      },
      JWT_SECRET,
      { expiresIn: "8h" },
    );
    res.cookie("accessToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.json({ success: true, message: "Token renovado" });
  } catch (err) {
    res
      .status(401)
      .json({ success: false, message: "Token inválido o expirado" });
  }
});

router.get("/2fa/setup", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userResult = await pool.query(
      "SELECT email FROM users WHERE id = $1",
      [userId],
    );
    const userEmail = userResult.rows[0]?.email || "usuario@pos.com";
    const secret = speakeasy.generateSecret({
      name: `POS System (${userEmail})`,
      length: 32,
    });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ success: true, data: { qrCodeUrl, secret: secret.base32 } });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

router.post("/2fa/verify", verifyToken, async (req, res) => {
  try {
    const { token, secret } = req.body;
    const userId = req.user.userId;
    if (!token || !secret)
      return res
        .status(400)
        .json({ success: false, message: "Token y secreto requeridos" });
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!verified) {
      await logAction("2FA_SETUP_FAILED", userId, req, {
        reason: "invalid_code",
      });
      return res
        .status(400)
        .json({ success: false, message: "Código inválido o expirado" });
    }
    await pool.query(
      "UPDATE users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = $2",
      [secret, userId],
    );
    await logAction("2FA_ENABLED", userId, req, {});
    res.json({ success: true, message: "✅ 2FA activado correctamente" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

router.post("/2fa/disable", verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.userId;
    const user = await pool.query(
      "SELECT two_factor_secret FROM users WHERE id = $1",
      [userId],
    );
    const secret = user.rows[0]?.two_factor_secret;
    if (!secret)
      return res
        .status(400)
        .json({ success: false, message: "2FA no configurado" });
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (!verified) {
      await logAction("2FA_DISABLE_FAILED", userId, req, {
        reason: "invalid_code",
      });
      return res
        .status(400)
        .json({ success: false, message: "Código inválido" });
    }
    await pool.query(
      "UPDATE users SET two_factor_secret = NULL, two_factor_enabled = false WHERE id = $1",
      [userId],
    );
    await logAction("2FA_DISABLED", userId, req, {});
    res.json({ success: true, message: "2FA desactivado correctamente" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

router.get("/2fa/status", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      "SELECT two_factor_enabled FROM users WHERE id = $1",
      [userId],
    );
    res.json({
      success: true,
      data: { enabled: result.rows[0]?.two_factor_enabled || false },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

router.post("/verify-password", verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    const validPass = await bcrypt.compare(
      password,
      result.rows[0].password_hash,
    );
    if (!validPass) {
      await logAction("PASSWORD_VERIFY_FAILED", userId, req, {});
      return res
        .status(401)
        .json({
          success: false,
          verified: false,
          message: "Contraseña incorrecta",
        });
    }
    res.json({ success: true, verified: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

router.post("/update-activity", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    await pool.query("UPDATE users SET last_activity = NOW() WHERE id = $1", [
      userId,
    ]);
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
