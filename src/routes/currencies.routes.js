// backend/src/routes/currencies.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// ✅ Esquema de validación
const currencySchema = z.object({
  code: z.string().min(1, "Código requerido").max(5, "Código muy largo").trim(),
  name: z
    .string()
    .min(1, "Nombre requerido")
    .max(50, "Nombre muy largo")
    .trim(),
  symbol: z
    .string()
    .min(1, "Símbolo requerido")
    .max(5, "Símbolo muy largo")
    .trim(),
  decimal_places: z.coerce.number().int().min(0).max(10).default(2),
  thousands_separator: z.string().max(1, "Separador muy largo").default(","),
  is_default: z.boolean().optional(),
});

// Obtener todas las monedas activas
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM currencies WHERE is_active = true ORDER BY name ASC",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error GET /currencies:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// Crear moneda (solo admin)
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const parsed = currencySchema.parse(req.body);
    const { code, name, symbol, decimal_places, thousands_separator } = parsed;
    const result = await pool.query(
      `INSERT INTO currencies (code, name, symbol, decimal_places, thousands_separator)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        symbol.trim(),
        decimal_places,
        thousands_separator,
      ],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Datos inválidos",
          errors: err.errors.map((e) => e.message),
        });
    }
    if (err.code === "23505")
      return res
        .status(409)
        .json({ success: false, message: "El código de moneda ya existe" });
    console.error("Error POST /currencies:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// Actualizar moneda (solo admin)
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const parsed = currencySchema.partial().parse(req.body);
    const {
      code,
      name,
      symbol,
      decimal_places,
      thousands_separator,
      is_default,
    } = parsed;
    const fields = [];
    const values = [];
    let idx = 1;
    if (code !== undefined) {
      fields.push(`code = $${idx++}`);
      values.push(code.trim().toUpperCase());
    }
    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (symbol !== undefined) {
      fields.push(`symbol = $${idx++}`);
      values.push(symbol.trim());
    }
    if (decimal_places !== undefined) {
      fields.push(`decimal_places = $${idx++}`);
      values.push(parseInt(decimal_places) || 2);
    }
    if (thousands_separator !== undefined) {
      fields.push(`thousands_separator = $${idx++}`);
      values.push(thousands_separator || ",");
    }
    if (is_default === true) {
      await pool.query(
        "UPDATE currencies SET is_default = false WHERE is_default = true",
      );
      fields.push(`is_default = true`);
    }
    fields.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const sql = `UPDATE currencies SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(sql, values);
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Moneda no encontrada" });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Datos inválidos",
          errors: err.errors.map((e) => e.message),
        });
    }
    if (err.code === "23505")
      return res
        .status(409)
        .json({
          success: false,
          message: "El código de moneda ya está en uso",
        });
    console.error("Error PUT /currencies:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// Desactivar moneda (solo admin)
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE currencies SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id",
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Moneda no encontrada" });
    res.json({ success: true, message: "Moneda desactivada" });
  } catch (err) {
    console.error("Error DELETE /currencies:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
