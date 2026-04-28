// backend/src/routes/logs.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

const logsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  start: z.string().optional(),
  end: z.string().optional(),
  user: z.string().optional(),
  action: z.string().optional(),
});

router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { page, limit, start, end, user, action } = logsQuerySchema.parse(
      req.query,
    );

    const pageNum = page;
    const limitNum = limit;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (start) {
      conditions.push(`al.created_at >= $${idx}`);
      values.push(start);
      idx++;
    }
    if (end) {
      conditions.push(`al.created_at <= $${idx}`);
      values.push(end);
      idx++;
    }
    if (action) {
      conditions.push(`al.action = $${idx}`);
      values.push(action);
      idx++;
    }
    if (user) {
      conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
      values.push(`%${user}%`);
      idx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
    `;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0].total);

    const dataSql = `
      SELECT al.id, u.name as user_name, u.role as user_role,
             al.action, al.details, al.created_at,
             al.ip_address
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    values.push(limitNum, offset);
    const dataRes = await pool.query(dataSql, values);

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Parámetros inválidos",
          errors: err.errors.map((e) => e.message),
        });
    }
    console.error("Error en GET /logs:", err);
    res.status(500).json({ success: false, message: "Error cargando logs" });
  }
});

export default router;
