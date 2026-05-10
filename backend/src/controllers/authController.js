import jwt from "jsonwebtoken";
import pool from "../db.js";
import { generate2FA, verify2FAToken } from "../utils/twoFactor.js";

const JWT_SECRET = process.env.JWT_SECRET || "secret";


// 🔹 SETUP 2FA
export const setup2FA = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT email FROM users WHERE id = $1",
      [userId]
    );

    const user = result.rows[0];

    const { secret, qr } = await generate2FA(user.email);

    await pool.query(
      "UPDATE users SET two_factor_temp_secret = $1 WHERE id = $2",
      [secret, userId]
    );

    res.json({ qr });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Error setup 2FA" });
  }
};


// 🔹 VERIFY 2FA (ACTIVAR)
export const verify2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    const result = await pool.query(
      "SELECT two_factor_temp_secret FROM users WHERE id = $1",
      [userId]
    );

    const secret = result.rows[0]?.two_factor_temp_secret;

    if (!secret) {
      return res.status(400).json({ msg: "No hay secret temporal" });
    }

    const isValid = verify2FAToken(token, secret);

    if (!isValid) {
      return res.status(400).json({ msg: "Código inválido" });
    }

    await pool.query(
      `UPDATE users SET 
        two_factor_secret = $1,
        two_factor_enabled = true,
        two_factor_temp_secret = NULL
       WHERE id = $2`,
      [secret, userId]
    );

    res.json({ msg: "2FA activado correctamente" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Error verify 2FA" });
  }
};


// 🔹 LOGIN
export const login = async (req, res) => {
  try {
    const { email, password, token } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ msg: "Usuario no existe" });
    }

    // ⚠️ CAMBIAR POR BCRYPT EN PRODUCCIÓN
    if (user.password !== password) {
      return res.status(400).json({ msg: "Password incorrecto" });
    }

    // 🔐 2FA
    if (user.two_factor_enabled) {

      // 👉 NO ENVIA TOKEN
      if (!token) {
        return res.json({ require2FA: true });
      }

      const isValid = verify2FAToken(token, user.two_factor_secret);

      if (!isValid) {
        return res.status(400).json({ msg: "Código 2FA incorrecto" });
      }
    }

    const jwtToken = jwt.sign(
      { id: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token: jwtToken });

  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Error login" });
  }
};