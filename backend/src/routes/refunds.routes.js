// backend/src/routes/refunds.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import { logAction } from "../services/auditService.js";

const router = express.Router();

const refundSchema = z.object({
  sale_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
  reason: z.string().optional().default("Devolución del cliente"),
  credit_note_number: z.string().max(50).optional(),
  customer_name: z.string().max(255).optional(),
  cf: z.boolean().optional(),
  fe: z.string().max(50).optional(),
});

// GET /api/refunds
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }
    const result = await pool.query(`
      SELECT r.*, u.name AS cashier_name, s.total AS original_total,
             COUNT(ri.id) AS items_count
      FROM refunds r
      JOIN users u ON r.user_id = u.id
      JOIN sales s ON r.sale_id = s.id
      LEFT JOIN refund_items ri ON r.id = ri.refund_id
      GROUP BY r.id, u.name, s.total
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error cargando devoluciones:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// GET /api/refunds/:id
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ri.product_id, p.name AS product_name, p.sku, ri.quantity, ri.unit_price, ri.subtotal
       FROM refund_items ri
       JOIN products p ON ri.product_id = p.id
       WHERE ri.refund_id = $1::uuid ORDER BY ri.created_at`,
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Devolución no encontrada" });
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error detalle devolución:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// POST /api/refunds - crear devolución (con nota de crédito)
router.post("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const parsed = refundSchema.parse(req.body);
    const {
      sale_id,
      items,
      reason,
      credit_note_number,
      customer_name,
      cf,
      fe,
    } = parsed;
    const userId = req.user?.id || req.user?.userId;

    await client.query("BEGIN");

    // Verificar que la venta existe y está completada
    const saleRes = await client.query(
      "SELECT id, total, payment_method, cash_session_id FROM sales WHERE id = $1::uuid AND status = 'completed'",
      [sale_id],
    );
    if (saleRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada o ya fue reembolsada",
      });
    }

    let totalRefunded = 0;
    const refundItemsData = [];

    for (const item of items) {
      const saleItem = await client.query(
        `SELECT si.quantity, si.unit_price, si.subtotal 
         FROM sale_items si 
         WHERE si.sale_id = $1::uuid AND si.product_id = $2::uuid`,
        [sale_id, item.product_id],
      );
      if (saleItem.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "El producto no pertenece a la venta",
        });
      }

      const originalQty = parseInt(saleItem.rows[0].quantity);
      if (item.quantity > originalQty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Cantidad a devolver excede la cantidad vendida",
        });
      }

      const unitPrice = parseFloat(saleItem.rows[0].unit_price);
      const subtotal = item.quantity * unitPrice;
      totalRefunded += subtotal;
      refundItemsData.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
      });
    }

    // Insertar refund con los nuevos campos
    const refundRes = await client.query(
      `INSERT INTO refunds (sale_id, cash_session_id, user_id, reason, total_refunded, status,
                            credit_note_number, customer_name, cf, fe)
       VALUES ($1::uuid, $2::integer, $3::uuid, $4, $5, 'completed', $6, $7, $8, $9) RETURNING id`,
      [
        sale_id,
        saleRes.rows[0].cash_session_id || null,
        userId,
        reason,
        totalRefunded,
        credit_note_number || null,
        customer_name || null,
        cf || false,
        fe || null,
      ],
    );
    const refundId = refundRes.rows[0].id;

    // Insertar items y actualizar stock
    for (const item of refundItemsData) {
      await client.query(
        `INSERT INTO refund_items (refund_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        [
          refundId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.subtotal,
        ],
      );
      await client.query(
        "UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2::uuid",
        [item.quantity, item.product_id],
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
         VALUES ($1::uuid, $2, 'increase', $3, $4::uuid)`,
        [
          item.product_id,
          item.quantity,
          `Devolución venta #${refundId.slice(0, 8)}`,
          userId,
        ],
      );
    }

    // Cambiar estado de la venta a 'refunded'
    await client.query(
      "UPDATE sales SET status = 'refunded' WHERE id = $1::uuid",
      [sale_id],
    );

    await client.query("COMMIT");

    await logAction("REFUND_CREATED", userId, req, {
      refundId,
      saleId: sale_id,
      totalRefunded,
      reason,
      creditNote: credit_note_number || null,
    });

    res.status(201).json({
      success: true,
      message: credit_note_number
        ? "Nota de crédito registrada"
        : "Devolución procesada",
      data: { refundId, totalRefunded, itemsCount: items.length },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    console.error("Error creando devolución:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

export default router;
