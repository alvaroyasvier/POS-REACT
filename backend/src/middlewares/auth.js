// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("❌ ERROR CRÍTICO: JWT_SECRET no definida en .env");
  throw new Error("JWT_SECRET no definida en .env");
}

export const verifyToken = async (req, res, next) => {
  // Obtener token desde la cookie (HttpOnly)
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, email, role, sessionId }

    const result = await pool.query(
      "SELECT current_session_id FROM users WHERE id = $1",
      [decoded.userId],
    );
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Usuario no encontrado" });
    }
    const currentSessionId = result.rows[0].current_session_id;
    if (!currentSessionId || currentSessionId !== decoded.sessionId) {
      return res.status(401).json({
        success: false,
        message: "Sesión cerrada por inicio en otro equipo",
        code: "SESSION_CONFLICT",
      });
    }

    await pool.query("UPDATE users SET last_activity = NOW() WHERE id = $1", [
      decoded.userId,
    ]);
    next();
  } catch (err) {
    console.error("❌ Error en verifyToken:", err.message);
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o expirado" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Acceso denegado" });
  }
  next();
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Rol no autorizado" });
    }
    next();
  };
};
