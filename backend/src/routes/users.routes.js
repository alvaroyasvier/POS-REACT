// backend/src/routes/users.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { logAction } from "../services/auditService.js";

const router = express.Router();

// ============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// ============================================================================

// Para crear usuario
const createUserSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "Nombre demasiado largo"),
  email: z.string().email("Formato de email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["admin", "cashier", "warehouse"], "Rol inválido"),
});

// Para editar usuario
const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100, "Nombre demasiado largo"),
  email: z.string().email("Formato de email inválido"),
  role: z.enum(["admin", "cashier", "warehouse"], "Rol inválido"),
});

// Para cambiar contraseña
const changePasswordSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

// ============================================================================
// RUTAS
// ============================================================================

// Obtener todos los usuarios (admin)
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, login_attempts, locked_until 
       FROM users ORDER BY created_at DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error al cargar usuarios:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener solo cajeros activos (admin)
router.get("/cashiers", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email FROM users WHERE role = 'cashier' AND is_active = true ORDER BY name ASC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error al cargar cajeros:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// Obtener un usuario por ID (admin)
router.get("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, login_attempts, locked_until 
       FROM users WHERE id = $1`,
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error al cargar usuario:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ✅ CREAR USUARIO (con validación Zod)
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  const client = await pool.connect();
  try {
    const parsed = createUserSchema.parse(req.body);
    const { name, email, password, role } = parsed;
    const createdByUserId = req.user?.id || req.user?.userId;

    await client.query("BEGIN");
    const hashedPassword = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, login_attempts, created_at) 
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 0, NOW()) 
       RETURNING id, name, email, role`,
      [name.trim(), email.trim().toLowerCase(), hashedPassword, role],
    );
    const newUser = userRes.rows[0];

    if (role === "cashier") {
      const registerName = `Caja - ${name.trim()}`;
      const regRes = await client.query(
        `INSERT INTO cash_registers (name, is_active) VALUES ($1, true) RETURNING id`,
        [registerName],
      );
      await client.query(
        `UPDATE users SET assigned_register_id = $1 WHERE id = $2`,
        [regRes.rows[0].id, newUser.id],
      );
    }

    await client.query("COMMIT");

    await logAction("USER_CREATED", createdByUserId, req, {
      createdUserId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      success: true,
      message:
        role === "cashier"
          ? "Cajero creado con su caja física asignada"
          : "Usuario creado exitosamente",
      data: newUser,
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
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "El email ya está registrado" });
    }
    console.error("Error al crear usuario:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

// ✅ EDITAR USUARIO (con validación Zod)
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const parsed = updateUserSchema.parse(req.body);
    const { name, email, role } = parsed;
    const editedByUserId = req.user?.id || req.user?.userId;
    const userId = req.params.id;

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4 
       RETURNING id, name, email, role, is_active, login_attempts, locked_until`,
      [name.trim(), email.trim().toLowerCase(), role, userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    await logAction("USER_UPDATED", editedByUserId, req, {
      updatedUserId: userId,
      changes: { name, email, role },
    });

    res.json({
      success: true,
      message: "Usuario actualizado correctamente",
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
    if (err.code === "23505") {
      return res
        .status(409)
        .json({
          success: false,
          message: "El email ya está en uso por otro usuario",
        });
    }
    console.error("Error al actualizar usuario:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ✅ CAMBIAR CONTRASEÑA (admin) con validación
router.put(
  "/:id/password",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const parsed = changePasswordSchema.parse(req.body);
      const { password } = parsed;
      const changedByUserId = req.user?.id || req.user?.userId;

      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        hashedPassword,
        req.params.id,
      ]);

      await logAction("USER_PASSWORD_CHANGED", changedByUserId, req, {
        targetUserId: req.params.id,
      });

      res.json({
        success: true,
        message: "Contraseña actualizada correctamente",
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: err.errors.map((e) => e.message),
        });
      }
      console.error("Error al cambiar contraseña:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// ✅ ACTIVAR / DESACTIVAR USUARIO
router.put(
  "/:id/status",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { is_active } = req.body;
      const changedByUserId = req.user?.id || req.user?.userId;

      if (typeof is_active !== "boolean") {
        return res
          .status(400)
          .json({ success: false, message: "El estado debe ser true o false" });
      }

      const result = await pool.query(
        `UPDATE users SET is_active = $1 WHERE id = $2 
       RETURNING id, name, email, role, is_active, login_attempts, locked_until`,
        [is_active, req.params.id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Usuario no encontrado" });
      }

      await logAction(
        is_active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        changedByUserId,
        req,
        {
          targetUserId: req.params.id,
        },
      );

      res.json({
        success: true,
        message: `Usuario ${is_active ? "activado" : "desactivado"} correctamente`,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Error al cambiar estado del usuario:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// ✅ DESBLOQUEAR USUARIO
router.post(
  "/:id/unlock",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const unlockedByUserId = req.user?.id || req.user?.userId;

      const result = await pool.query(
        `UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1 
       RETURNING id, name, email, login_attempts, locked_until`,
        [req.params.id],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Usuario no encontrado" });
      }

      await logAction("USER_UNLOCKED", unlockedByUserId, req, {
        targetUserId: req.params.id,
      });

      res.json({
        success: true,
        message: `Usuario "${result.rows[0].name}" desbloqueado correctamente`,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("Error al desbloquear usuario:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// ✅ ELIMINAR USUARIO (admin)
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const deletedByUserId = req.user?.id || req.user?.userId;

    const userCheck = await pool.query(
      `SELECT id, name, email, role FROM users WHERE id = $1`,
      [req.params.id],
    );
    if (userCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    const adminCount = await pool.query(
      `SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true`,
    );
    if (
      userCheck.rows[0].role === "admin" &&
      parseInt(adminCount.rows[0].count) <= 1
    ) {
      return res.status(400).json({
        success: false,
        message: "No se puede eliminar el último administrador del sistema",
      });
    }

    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, name, email`,
      [req.params.id],
    );

    await logAction("USER_DELETED", deletedByUserId, req, {
      deletedUserId: req.params.id,
      name: result.rows[0].name,
      email: result.rows[0].email,
    });

    res.json({
      success: true,
      message: `Usuario "${result.rows[0].name}" eliminado correctamente`,
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "No se puede eliminar: tiene registros asociados",
      });
    }
    console.error("Error al eliminar usuario:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
