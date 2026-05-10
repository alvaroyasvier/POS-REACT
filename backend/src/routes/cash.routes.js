// backend/src/routes/cash.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import { logAction } from "../services/auditService.js";

const router = express.Router();

// ============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// ============================================================================

// Para apertura de sesión (admin)
const openSessionSchema = z.object({
  user_id: z.string().uuid("ID de usuario inválido"),
  initial_amount: z
    .number()
    .positive("El monto inicial debe ser positivo")
    .min(0.01, "Monto mínimo 0.01"),
});

// Para cierre de sesión (admin o cajero)
const closeSessionSchema = z.object({
  counts: z
    .array(
      z.object({
        denomination_id: z.number().int().positive(),
        quantity: z.number().int().min(0),
      }),
    )
    .min(1, "Debe incluir al menos un conteo"),
  card_amount: z.number().min(0).default(0),
  transfer_amount: z.number().min(0).default(0),
});

// ============================================================================
// RUTAS
// ============================================================================

// Obtener todas las cajas registradoras activas
router.get("/registers", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cash_registers WHERE is_active = true",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener cajas" });
  }
});

// Obtener denominaciones activas (billetes/monedas)
router.get("/denominations", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cash_denominations WHERE is_active = true ORDER BY value DESC",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener denominaciones" });
  }
});

// Obtener sesión activa del usuario actual
router.get("/sessions/active", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      `SELECT cs.*, cr.name as register_name, u.name as cashier_name 
       FROM cash_sessions cs 
       JOIN cash_registers cr ON cs.cash_register_id = cr.id 
       JOIN users u ON cs.user_id = u.id 
       WHERE cs.user_id = $1 AND cs.status = 'open'`,
      [userId],
    );
    if (result.rows.length === 0)
      return res.json({ success: true, data: null });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener sesión activa" });
  }
});

// Obtener todas las sesiones activas (admin)
router.get("/sessions/all-active", verifyToken, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ success: false, message: "Acceso denegado" });
  try {
    const result = await pool.query(
      `SELECT cs.*, cr.name as register_name, u.name as cashier_name, u.email as cashier_email 
       FROM cash_sessions cs 
       JOIN cash_registers cr ON cs.cash_register_id = cr.id 
       JOIN users u ON cs.user_id = u.id 
       WHERE cs.status = 'open' ORDER BY cs.opening_date ASC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener sesiones activas" });
  }
});

// Obtener sesiones cerradas (historial de cierres)
router.get("/sessions/closed", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.initial_amount, cs.closing_amount, cs.expected_amount, cs.difference, cs.closing_date, cs.status,
              u.name AS cashier_name, cr.name AS register_name 
       FROM cash_sessions cs 
       JOIN users u ON cs.user_id = u.id 
       JOIN cash_registers cr ON cs.cash_register_id = cr.id 
       WHERE cs.status = 'closed' ORDER BY cs.closing_date DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error cargando historial de cierres:", err);
    res.status(500).json({
      success: false,
      message: "Error al cargar historial de cierres",
    });
  }
});

// ============================================================================
// ADMIN: ABRIR SESIÓN (con validación Zod)
// ============================================================================
router.post("/sessions/admin/open", verifyToken, async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  if (req.user.role !== "admin")
    return res.status(403).json({ success: false, message: "Acceso denegado" });

  try {
    const parsed = openSessionSchema.parse(req.body);
    const { user_id, initial_amount } = parsed;

    const userRes = await pool.query(
      `SELECT u.id, u.role, u.assigned_register_id, cr.name AS register_name 
       FROM users u LEFT JOIN cash_registers cr ON u.assigned_register_id = cr.id 
       WHERE u.id = $1::uuid`,
      [user_id],
    );
    if (userRes.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });

    const user = userRes.rows[0];
    if (user.role !== "cashier")
      return res.status(400).json({
        success: false,
        message: "Solo se pueden abrir sesiones para cajeros",
      });
    if (!user.assigned_register_id)
      return res.status(400).json({
        success: false,
        message: `El cajero "${user.name || user.email}" no tiene una caja física asignada.`,
      });

    const existingRegister = await pool.query(
      "SELECT id FROM cash_sessions WHERE cash_register_id = $1 AND status = 'open'",
      [user.assigned_register_id],
    );
    if (existingRegister.rows.length > 0)
      return res.status(409).json({
        success: false,
        message: `La caja "${user.register_name}" ya tiene una sesión abierta.`,
      });

    const existingUserSession = await pool.query(
      "SELECT id FROM cash_sessions WHERE user_id = $1::uuid AND status = 'open'",
      [user_id],
    );
    if (existingUserSession.rows.length > 0)
      return res.status(409).json({
        success: false,
        message: "El usuario ya tiene una sesión abierta.",
      });

    const result = await pool.query(
      `INSERT INTO cash_sessions (cash_register_id, user_id, initial_amount, status) 
       VALUES ($1, $2::uuid, $3, 'open') RETURNING *`,
      [user.assigned_register_id, user_id, initial_amount],
    );

    await logAction("CASH_SESSION_OPENED", userId, req, {
      cashierId: user_id,
      registerId: user.assigned_register_id,
      initialAmount: initial_amount,
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ============================================================================
// ADMIN: CERRAR SESIÓN DE CUALQUIER CAJERO (con validación Zod)
// ============================================================================
router.post("/sessions/:id/admin-close", verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.userId || req.user?.id;
  if (req.user.role !== "admin")
    return res.status(403).json({ success: false, message: "Acceso denegado" });

  try {
    const parsed = closeSessionSchema.parse(req.body);
    const { counts, card_amount, transfer_amount } = parsed;

    await pool.query("BEGIN");

    const sessionRes = await pool.query(
      "SELECT * FROM cash_sessions WHERE id = $1 AND status = $2",
      [id, "open"],
    );
    if (sessionRes.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, message: "Sesión no encontrada o ya cerrada" });
    }
    const session = sessionRes.rows[0];

    for (const count of counts) {
      if (count.quantity > 0) {
        await pool.query(
          "INSERT INTO cash_counts (cash_session_id, denomination_id, quantity) VALUES ($1, $2, $3)",
          [id, count.denomination_id, count.quantity],
        );
      }
    }

    const totalResult = await pool.query(
      "SELECT SUM(cc.quantity * cd.value) as total FROM cash_counts cc JOIN cash_denominations cd ON cc.denomination_id = cd.id WHERE cc.cash_session_id = $1",
      [id],
    );
    const cashTotal = parseFloat(totalResult.rows[0].total || 0);
    const closing_amount =
      cashTotal + parseFloat(card_amount) + parseFloat(transfer_amount);

    // ✅ Ventas reales de la sesión SOLO COMPLETADAS
    const salesResult = await pool.query(
      "SELECT payment_method, COALESCE(SUM(total), 0) as total FROM sales WHERE cash_session_id = $1 AND status = 'completed' GROUP BY payment_method",
      [id],
    );
    const totals = { cash: 0, card: 0, transfer: 0 };
    salesResult.rows.forEach((r) => {
      totals[r.payment_method] = parseFloat(r.total) || 0;
    });

    const movementsResult = await pool.query(
      "SELECT SUM(CASE WHEN type = 'withdrawal' THEN -amount ELSE amount END) as net FROM cash_movements WHERE cash_session_id = $1",
      [id],
    );
    const netMovements = parseFloat(movementsResult.rows[0].net || 0);

    const expected_amount =
      parseFloat(session.initial_amount) +
      totals.cash +
      totals.card +
      totals.transfer +
      netMovements;
    const difference = closing_amount - expected_amount;

    await pool.query(
      "UPDATE cash_sessions SET closing_date = NOW(), closing_amount = $1, expected_amount = $2, difference = $3, status = 'closed' WHERE id = $4",
      [closing_amount, expected_amount, difference, id],
    );
    await pool.query("COMMIT");

    await logAction("CASH_SESSION_CLOSED", userId, req, {
      sessionId: id,
      closingAmount: closing_amount,
      expectedAmount: expected_amount,
      difference,
    });

    res.json({
      success: true,
      message: "Caja cerrada correctamente",
      data: { closing_amount, expected_amount, difference },
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos de arqueo inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ============================================================================
// CAJERO: CERRAR SU PROPIA SESIÓN (con validación Zod)
// ============================================================================
router.post("/sessions/:id/close", verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.userId || req.user?.id;

  try {
    const parsed = closeSessionSchema.parse(req.body);
    const { counts, card_amount, transfer_amount } = parsed;

    await pool.query("BEGIN");

    const sessionRes = await pool.query(
      "SELECT * FROM cash_sessions WHERE id = $1 AND user_id = $2::uuid AND status = $3",
      [id, userId, "open"],
    );
    if (sessionRes.rows.length === 0) {
      await pool.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Sesión no encontrada, no te pertenece o ya está cerrada",
      });
    }
    const session = sessionRes.rows[0];

    for (const count of counts) {
      if (count.quantity > 0) {
        await pool.query(
          "INSERT INTO cash_counts (cash_session_id, denomination_id, quantity) VALUES ($1, $2, $3)",
          [id, count.denomination_id, count.quantity],
        );
      }
    }

    const totalResult = await pool.query(
      "SELECT SUM(cc.quantity * cd.value) as total FROM cash_counts cc JOIN cash_denominations cd ON cc.denomination_id = cd.id WHERE cc.cash_session_id = $1",
      [id],
    );
    const cashTotal = parseFloat(totalResult.rows[0].total || 0);
    const closing_amount =
      cashTotal + parseFloat(card_amount) + parseFloat(transfer_amount);

    // ✅ Ventas reales de la sesión SOLO COMPLETADAS
    const salesResult = await pool.query(
      "SELECT payment_method, COALESCE(SUM(total), 0) as total FROM sales WHERE cash_session_id = $1 AND status = 'completed' GROUP BY payment_method",
      [id],
    );
    const totals = { cash: 0, card: 0, transfer: 0 };
    salesResult.rows.forEach((r) => {
      totals[r.payment_method] = parseFloat(r.total) || 0;
    });

    const movementsResult = await pool.query(
      "SELECT SUM(CASE WHEN type = 'withdrawal' THEN -amount ELSE amount END) as net FROM cash_movements WHERE cash_session_id = $1",
      [id],
    );
    const netMovements = parseFloat(movementsResult.rows[0].net || 0);

    const expected_amount =
      parseFloat(session.initial_amount) +
      totals.cash +
      totals.card +
      totals.transfer +
      netMovements;
    const difference = closing_amount - expected_amount;

    await pool.query(
      "UPDATE cash_sessions SET closing_date = NOW(), closing_amount = $1, expected_amount = $2, difference = $3, status = 'closed' WHERE id = $4",
      [closing_amount, expected_amount, difference, id],
    );
    await pool.query("COMMIT");

    await logAction("CASH_SESSION_CLOSED", userId, req, {
      sessionId: id,
      closingAmount: closing_amount,
      expectedAmount: expected_amount,
      difference,
    });

    res.json({
      success: true,
      message: "Caja cerrada correctamente",
      data: { closing_amount, expected_amount, difference },
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos de arqueo inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
