// backend/src/routes/invoices.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// GET /api/invoices
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const querySchema = z.object({
      start: z.string().optional(),
      end: z.string().optional(),
      customer: z.string().optional(),
      invoice: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });
    const { start, end, customer, invoice, page, limit } = querySchema.parse(req.query);

    const conditions = ["s.status = 'completed'"];
    const values = [];

    if (start) {
      conditions.push(`s.created_at >= $${values.length + 1}`);
      values.push(new Date(start));
    }
    if (end) {
      conditions.push(`s.created_at <= $${values.length + 1}`);
      values.push(new Date(end + "T23:59:59"));
    }
    if (customer) {
      conditions.push(`s.customer_name ILIKE $${values.length + 1}`);
      values.push(`%${customer}%`);
    }
    if (invoice) {
      conditions.push(`s.invoice_number ILIKE $${values.length + 1}`);
      values.push(`%${invoice}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Obtener total
    const countSql = `SELECT COUNT(*) FROM sales s ${whereClause}`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].count);
    const offset = (page - 1) * limit;

    // Obtener datos con paginación
    const dataSql = `
      SELECT 
        s.invoice_number AS "Factura",
        s.created_at AS "Fecha",
        COALESCE(s.customer_name, 'N/A') AS "Cliente",
        CASE WHEN s.cf THEN 'SI' ELSE 'NO' END AS "C.F.",
        s.fe AS "FE",
        s.total AS "Importe"
      FROM sales s
      ${whereClause}
      ORDER BY s.created_at DESC
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
    console.error("Error en GET /invoices:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;