// backend/src/routes/reports.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

const dashboardQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  start: z.string().optional(),
  end: z.string().optional(),
  paymentMethod: z.string().optional(),
  cashierId: z.string().optional(),
});

// Helper para estandarizar fechas
const normalizeDateRange = (startStr, endStr) => {
  if (!startStr || !endStr) return { start: null, end: null };
  const start = new Date(startStr);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endStr);
  end.setUTCHours(23, 59, 59, 999);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

// Helper para construir WHERE
const buildWhereClause = (
  start,
  end,
  paymentMethod,
  cashierId,
  userIdForNonAdmin,
) => {
  const conditions = [];
  const values = [];
  let idx = 1;

  if (start && end) {
    conditions.push(`s.created_at >= $${idx}::timestamp`);
    values.push(start);
    idx++;
    conditions.push(`s.created_at <= $${idx}::timestamp`);
    values.push(end);
    idx++;
  }

  if (paymentMethod) {
    conditions.push(`s.payment_method = $${idx}`);
    values.push(paymentMethod);
    idx++;
  }

  if (cashierId) {
    conditions.push(`s.user_id = $${idx}::uuid`);
    values.push(cashierId);
    idx++;
  }

  if (userIdForNonAdmin) {
    conditions.push(`s.user_id = $${idx}::uuid`);
    values.push(userIdForNonAdmin);
    idx++;
  }

  conditions.push(`s.status = 'completed'`);

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { whereClause, values };
};

// Helper para obtener rango de fechas según período rápido
const getDateRange = (period) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "weekly") {
    start.setDate(now.getDate() - 7);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    start.setMonth(now.getMonth() - 1);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  } else {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
  }

  return { start: start.toISOString(), end: end.toISOString() };
};

// GET /dashboard
router.get(
  "/dashboard",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        period,
        start: customStart,
        end: customEnd,
        paymentMethod,
        cashierId,
      } = dashboardQuerySchema.parse(req.query);

      let start, end;
      if (customStart && customEnd) {
        const normalized = normalizeDateRange(customStart, customEnd);
        start = normalized.start;
        end = normalized.end;
      } else {
        const range = getDateRange(period);
        start = range.start;
        end = range.end;
      }

      const { whereClause, values } = buildWhereClause(
        start,
        end,
        paymentMethod,
        cashierId,
      );
      // GET /reports/top-products
      router.get(
        "/top-products",
        verifyToken,
        requireRole("admin"),
        async (req, res) => {
          try {
            const { start, end } = req.query;
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

            const whereClause = conditions.length
              ? `WHERE ${conditions.join(" AND ")}`
              : "";

            const sql = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.image_url,
        SUM(si.quantity) AS total_quantity,
        SUM(si.subtotal) AS total_amount
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      ${whereClause}
      GROUP BY p.id, p.name, p.image_url
      ORDER BY total_quantity DESC
      LIMIT 10
    `;

            const result = await pool.query(sql, values);
            res.json({ success: true, data: result.rows });
          } catch (err) {
            console.error("Error en top-products:", err);
            res
              .status(500)
              .json({ success: false, message: "Error interno del servidor" });
          }
        },
      );
      // 1. Totales globales
      const globalQuery = `
      SELECT 
        COUNT(*)::int as total_sales, 
        COALESCE(SUM(total),0)::float as total_revenue,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END),0)::float as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END),0)::float as card_total,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END),0)::float as transfer_total
      FROM sales s
      ${whereClause}
    `;
      const global = await pool.query(globalQuery, values);

      // 2. Por cajero
      const byCashierQuery = `
      SELECT 
        u.id as cashier_id,
        u.name as cashier_name, 
        u.email,
        COUNT(s.id)::int as total_sales,
        COALESCE(SUM(s.total),0)::float as total_collected
      FROM users u 
      JOIN sales s ON u.id = s.user_id
      ${whereClause}
      GROUP BY u.id, u.name, u.email 
      ORDER BY total_collected DESC
    `;
      const byCashier = await pool.query(byCashierQuery, values);

      // 3. Últimas ventas (limitadas a 10)
      const lastSalesQuery = `
      SELECT 
        s.id, 
        s.total::float, 
        s.payment_method, 
        s.created_at, 
        u.name as cashier_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)::int as items_count
      FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.created_at DESC 
      LIMIT 10
    `;
      const lastSales = await pool.query(lastSalesQuery, values);

      res.json({
        success: true,
        data: {
          period,
          range: { start, end },
          summary: global.rows[0],
          by_cashier: byCashier.rows,
          last_10: lastSales.rows,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Parámetros inválidos",
          errors: err.errors.map((e) => e.message),
        });
      }
      console.error("❌ Error dashboard:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// GET /my-stats
router.get("/my-stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const range = getDateRange("daily");
    const { whereClause, values } = buildWhereClause(
      range.start,
      range.end,
      null,
      null,
      userId,
    );

    const stats = await pool.query(
      `SELECT COUNT(*)::int as total_sales, COALESCE(SUM(total),0)::float as total_collected
       FROM sales s
       ${whereClause}`,
      values,
    );

    res.json({ success: true, data: stats.rows[0] });
  } catch (err) {
    console.error("❌ Error stats cajera:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
