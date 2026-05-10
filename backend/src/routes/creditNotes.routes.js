// backend/src/routes/creditNotes.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// GET /api/credit-notes
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const querySchema = z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      customer: z.string().optional(),
      noteNumber: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });
    const { start, end, customer, noteNumber, page, limit } = querySchema.parse(
      req.query,
    );

    const conditions = [];
    const values = [];

    if (start) {
      conditions.push(`r.created_at >= $${values.length + 1}`);
      values.push(new Date(start));
    }
    if (end) {
      conditions.push(`r.created_at <= $${values.length + 1}`);
      values.push(new Date(end + "T23:59:59"));
    }
    if (customer) {
      conditions.push(`r.customer_name ILIKE $${values.length + 1}`);
      values.push(`%${customer}%`);
    }
    if (noteNumber) {
      conditions.push(`r.credit_note_number ILIKE $${values.length + 1}`);
      values.push(`%${noteNumber}%`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Count
    const countSql = `SELECT COUNT(*) FROM refunds r ${whereClause}`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count);
    const offset = (page - 1) * limit;

    // Query principal con agregación de productos
    const dataSql = `
      SELECT 
        r.credit_note_number AS "Factura",
        r.created_at AS "Fecha",
        COALESCE(r.customer_name, 'N/A') AS "Cliente",
        CASE WHEN r.cf THEN 'SI' ELSE 'NO' END AS "C.F.",
        r.fe AS "FE",
        r.total_refunded AS "Importe",
        r.reason AS "Motivo",
        STRING_AGG(p.name || ' x' || ri.quantity, ', ' ORDER BY ri.id) AS "Productos"
      FROM refunds r
      LEFT JOIN refund_items ri ON r.id = ri.refund_id
      LEFT JOIN products p ON ri.product_id = p.id
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    values.push(limit, offset);
    const result = await pool.query(dataSql, values);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error en GET /credit-notes:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
