// backend/src/routes/sales.routes.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import { logAction } from "../services/auditService.js";
import z from "zod";

const router = express.Router();

// ---------- ESQUEMAS DE VALIDACIÓN ----------
const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive().max(9999),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["cash", "card", "transfer"]).default("cash"),
  invoice_number: z.string().max(50).optional(),
  customer_name: z.string().max(255).optional(),
  cf: z.boolean().optional(),
  fe: z.string().max(50).optional(),
});

const invoiceUpdateSchema = z.object({
  invoice_number: z.string().min(1, "Número de factura requerido").max(50),
  customer_name: z.string().min(1, "Nombre del cliente requerido").max(255),
  cf: z.boolean().default(false),
  fe: z.string().max(50).optional().nullable(),
});

// Helper
const getAuthUser = (req) => ({
  id: req.user?.id || req.user?.sub || req.user?.userId,
  role: (req.user?.role || req.user?.rol || "").trim().toLowerCase(),
});

// ============================================================
// RUTA: GET /stats
// ============================================================
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    const { start, end, status, paymentMethod } = req.query;
    const conditions = [],
      values = [];
    if (user.role !== "admin") {
      conditions.push(`s.user_id = $${values.length + 1}::uuid`);
      values.push(user.id);
    }
    if (start) {
      conditions.push(`s.created_at >= $${values.length + 1}`);
      values.push(new Date(start));
    }
    if (end) {
      conditions.push(`s.created_at <= $${values.length + 1}`);
      values.push(new Date(end + "T23:59:59"));
    }
    if (status) {
      conditions.push(`s.status = $${values.length + 1}`);
      values.push(status);
    }
    if (paymentMethod) {
      conditions.push(`s.payment_method = $${values.length + 1}`);
      values.push(paymentMethod);
    }

    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')`,
    );
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";
    let sql = `SELECT COUNT(*) as total_transacciones, COALESCE(SUM(${totalColumn}), 0) as total_ingresos, COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN ${totalColumn} ELSE 0 END), 0) as total_efectivo, COALESCE(SUM(CASE WHEN payment_method = 'card' THEN ${totalColumn} ELSE 0 END), 0) as total_tarjeta, COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN ${totalColumn} ELSE 0 END), 0) as total_transferencia FROM sales s`;
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
    const result = await pool.query(sql, values);
    const stats = result.rows[0];
    res.json({
      success: true,
      data: {
        totalTransacciones: parseInt(stats.total_transacciones),
        totalVentas: parseFloat(stats.total_ingresos),
        porMetodo: {
          efectivo: parseFloat(stats.total_efectivo),
          tarjeta: parseFloat(stats.total_tarjeta),
          transferencia: parseFloat(stats.total_transferencia),
        },
      },
    });
  } catch (err) {
    console.error("Error GET /stats:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al cargar estadísticas" });
  }
});

// ============================================================
// RUTA: GET /stock-movements
// ============================================================
router.get("/stock-movements", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    const {
      start,
      end,
      productId,
      movementType,
      page = 1,
      limit = 20,
    } = req.query;
    const offset = (parseInt(page) - 1) * Math.max(parseInt(limit), 1);
    const conditions = [],
      values = [];
    if (user.role !== "admin") {
      conditions.push(`sm.created_by = $${values.length + 1}::uuid`);
      values.push(user.id);
    }
    if (start) {
      const startDate = new Date(start);
      if (isNaN(startDate.getTime()))
        return res
          .status(400)
          .json({ success: false, message: "Fecha inicio inválida" });
      conditions.push(`sm.created_at >= $${values.length + 1}`);
      values.push(startDate);
    }
    if (end) {
      const endDate = new Date(end + "T23:59:59");
      if (isNaN(endDate.getTime()))
        return res
          .status(400)
          .json({ success: false, message: "Fecha fin inválida" });
      conditions.push(`sm.created_at <= $${values.length + 1}`);
      values.push(endDate);
    }
    if (productId) {
      conditions.push(`sm.product_id = $${values.length + 1}::uuid`);
      values.push(productId);
    }
    if (movementType) {
      if (movementType === "increase") {
        conditions.push(`sm.movement_type IN ('increase', 'purchase')`);
      } else if (movementType === "decrease") {
        conditions.push(`sm.movement_type IN ('decrease', 'sale')`);
      } else {
        conditions.push(`sm.movement_type = $${values.length + 1}`);
        values.push(movementType);
      }
    }
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";
    const sql = `
      SELECT sm.id, sm.product_id, p.name AS product_name, ABS(sm.quantity) AS quantity, sm.movement_type, sm.reason, sm.created_at, sm.created_by, u.name AS user_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      ${whereClause}
      ORDER BY sm.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const countSql = `SELECT COUNT(*) FROM stock_movements sm ${whereClause}`;
    const result = await pool.query(sql, [...values, parseInt(limit), offset]);
    const countResult = await pool.query(countSql, values);
    const total = parseInt(countResult.rows[0].count);
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)) || 1,
      },
    });
  } catch (err) {
    console.error("Error GET /stock-movements:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ============================================================
// POST / - Procesar venta (MODIFICADO para aceptar factura)
// ============================================================
router.post("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const validated = saleSchema.parse(req.body);
    const { items, paymentMethod, invoice_number, customer_name, cf, fe } =
      validated;
    const user = getAuthUser(req);
    if (!user.id)
      return res
        .status(401)
        .json({ success: false, message: "Usuario no autenticado" });

    await client.query("BEGIN");

    // sesión de caja
    let cash_session_id = null;
    if (user.role !== "admin") {
      const cashSessionRes = await client.query(
        "SELECT id FROM cash_sessions WHERE user_id = $1::uuid AND status = 'open'",
        [user.id],
      );
      if (cashSessionRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "No hay una sesión de caja abierta.",
        });
      }
      cash_session_id = cashSessionRes.rows[0].id;
    }

    let total = 0;
    const saleItemsData = [];
    for (const item of items) {
      const productRes = await client.query(
        "SELECT id, sale_price, stock, name FROM products WHERE id = $1::uuid AND is_active = true FOR UPDATE",
        [item.productId],
      );
      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: `Producto no encontrado: ${item.productId}`,
        });
      }
      const product = productRes.rows[0];
      if (parseInt(product.stock) < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Stock insuficiente para "${product.name}"`,
        });
      }
      await client.query(
        "UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2::uuid",
        [item.quantity, item.productId],
      );
      saleItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: parseFloat(product.sale_price),
        subtotal: item.quantity * parseFloat(product.sale_price),
      });
      total += item.quantity * parseFloat(product.sale_price);
    }

    const colRes = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')`,
    );
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";
    const saleRes = await client.query(
      `INSERT INTO sales (user_id, payment_method, ${totalColumn}, status, created_at, cash_session_id, invoice_number, customer_name, cf, fe)
       VALUES ($1::uuid, $2, $3, 'completed', NOW(), $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        user.id,
        paymentMethod,
        total,
        cash_session_id,
        invoice_number || null,
        customer_name || null,
        cf || false,
        fe || null,
      ],
    );
    const saleId = saleRes.rows[0].id;

    for (const d of saleItemsData) {
      await client.query(
        "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) VALUES ($1, $2::uuid, $3, $4, $5)",
        [saleId, d.productId, d.quantity, d.unitPrice, d.subtotal],
      );
    }
    for (const item of items) {
      await client.query(
        "INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by, sale_id) VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6)",
        [
          item.productId,
          -item.quantity,
          "sale",
          "Venta en POS",
          user.id,
          saleId,
        ],
      );
    }

    await client.query("COMMIT");

    await logAction("SALE_COMPLETED", user.id, req, {
      saleId,
      total,
      paymentMethod,
      itemsCount: items.length,
      invoice: invoice_number || null,
    });

    res.status(201).json({
      success: true,
      message: "Venta procesada exitosamente",
      data: {
        saleId,
        total,
        createdAt: saleRes.rows[0].created_at,
        paymentMethod,
        itemsCount: items.length,
        invoice_number: invoice_number || null,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.name === "ZodError")
      return res.status(400).json({
        success: false,
        message: err.errors.map((e) => e.message).join(", "),
      });
    console.error("Error POST /sales:", err);
    res
      .status(500)
      .json({ success: false, message: err.message || "Error interno" });
  } finally {
    client.release();
  }
});

// ============================================================
// GET / - Listar ventas (historial)
// ============================================================
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    const {
      start,
      end,
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      cash_session_id,
    } = req.query;
    const offset = (parseInt(page) - 1) * Math.max(parseInt(limit), 1);
    const conditions = [],
      values = [];
    if (user.role !== "admin") {
      conditions.push(`s.user_id = $${values.length + 1}::uuid`);
      values.push(user.id);
    }
    if (start) {
      conditions.push(`s.created_at >= $${values.length + 1}`);
      values.push(new Date(start));
    }
    if (end) {
      conditions.push(`s.created_at <= $${values.length + 1}`);
      values.push(new Date(end + "T23:59:59"));
    }
    if (status) {
      conditions.push(`s.status = $${values.length + 1}`);
      values.push(status);
    }
    if (paymentMethod) {
      conditions.push(`s.payment_method = $${values.length + 1}`);
      values.push(paymentMethod);
    }
    if (cash_session_id) {
      conditions.push(`s.cash_session_id = $${values.length + 1}`);
      values.push(cash_session_id);
    }

    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')`,
    );
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";
    let sql = `SELECT s.id, s.${totalColumn} as total, s.payment_method, s.status, s.created_at, s.user_id, COALESCE(u.name, 'Cajera') AS cashier_name, COUNT(si.id) as items_count, s.invoice_number, s.customer_name, s.cf, s.fe
               FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN sale_items si ON s.id = si.sale_id`;
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
    sql += ` GROUP BY s.id, s.${totalColumn}, s.payment_method, s.status, s.created_at, s.user_id, u.name ORDER BY s.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(parseInt(limit), offset);
    const result = await pool.query(sql, values);

    let countSql = `SELECT COUNT(DISTINCT s.id) FROM sales s`;
    if (conditions.length > 0) countSql += ` WHERE ${conditions.join(" AND ")}`;
    const countResult = await pool.query(countSql, values.slice(0, -2));
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages:
          Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)) || 1,
      },
    });
  } catch (err) {
    console.error("Error GET /sales:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al cargar historial" });
  }
});

// ============================================================
// GET /:id - Detalle de una venta
// ============================================================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id))
      return res.status(400).json({ success: false, message: "ID no válido" });
    const user = getAuthUser(req);
    if (user.role !== "admin") {
      const saleCheck = await pool.query(
        "SELECT user_id FROM sales WHERE id = $1::uuid",
        [req.params.id],
      );
      if (
        saleCheck.rows.length === 0 ||
        String(saleCheck.rows[0].user_id) !== String(user.id)
      )
        return res
          .status(403)
          .json({ success: false, message: "Acceso denegado" });
    }
    const colRes = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')`,
    );
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";
    const sql = `SELECT s.id, s.${totalColumn} as total, s.payment_method, s.status, s.created_at, s.user_id, COALESCE(u.name, 'Cajera') AS cashier_name, si.id AS sale_item_id, si.quantity, si.unit_price, si.subtotal, p.id AS product_id, p.name AS product_name, p.sku AS product_sku, p.image_url AS product_image, s.invoice_number, s.customer_name, s.cf, s.fe
                 FROM sales s LEFT JOIN users u ON s.user_id = u.id LEFT JOIN sale_items si ON s.id = si.sale_id LEFT JOIN products p ON si.product_id = p.id
                 WHERE s.id = $1::uuid ORDER BY si.id ASC`;
    const result = await pool.query(sql, [req.params.id]);
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Venta no encontrada" });
    const sale = result.rows[0];
    const items = result.rows
      .filter((r) => r.product_id)
      .map((r) => ({
        saleItemId: r.sale_item_id,
        productId: r.product_id,
        name: r.product_name,
        sku: r.product_sku,
        image: r.product_image,
        quantity: parseInt(r.quantity),
        unitPrice: parseFloat(r.unit_price),
        subtotal: parseFloat(r.subtotal),
      }));
    res.json({
      success: true,
      data: {
        id: sale.id,
        total: parseFloat(sale.total),
        paymentMethod: sale.payment_method,
        status: sale.status,
        createdAt: sale.created_at,
        cashier: { id: sale.user_id, name: sale.cashier_name },
        items,
        invoice_number: sale.invoice_number,
        customer_name: sale.customer_name,
        cf: sale.cf,
        fe: sale.fe,
      },
    });
  } catch (err) {
    console.error("Error GET /sales/:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al cargar detalles" });
  }
});

// ============================================================
// NUEVO ENDPOINT: PUT /:id/assign-invoice
// Asigna datos de factura a una venta existente
// ============================================================
router.put("/:id/assign-invoice", verifyToken, async (req, res) => {
  try {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id))
      return res
        .status(400)
        .json({ success: false, message: "ID de venta inválido" });

    // Solo admin puede asignar facturas
    const user = getAuthUser(req);
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Solo administradores pueden generar facturas",
      });
    }

    const parsed = invoiceUpdateSchema.parse(req.body);
    const { invoice_number, customer_name, cf, fe } = parsed;

    // Verificar que la venta existe y no tiene ya factura (opcional, puede sobrescribirse)
    const saleRes = await pool.query(
      "SELECT id, invoice_number FROM sales WHERE id = $1::uuid AND status = 'completed'",
      [req.params.id],
    );
    if (saleRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada o no completada",
      });
    }

    // Actualizar
    const result = await pool.query(
      `UPDATE sales SET invoice_number = $1, customer_name = $2, cf = $3, fe = $4
       WHERE id = $5::uuid
       RETURNING id, invoice_number, customer_name, cf, fe`,
      [
        invoice_number.trim(),
        customer_name.trim(),
        cf,
        fe || null,
        req.params.id,
      ],
    );

    await logAction("INVOICE_ASSIGNED", user.id, req, {
      saleId: req.params.id,
      invoice_number,
      customer_name,
      cf,
      fe,
    });

    res.json({
      success: true,
      message: "Factura asignada correctamente",
      data: result.rows[0],
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    console.error("Error al asignar factura:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
