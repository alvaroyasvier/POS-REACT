// backend/src/routes/categories.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { logAction } from "../services/auditService.js";

const router = express.Router();

// Esquema de validación para crear/actualizar categoría
const categorySchema = z.object({
  name: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(50, "El nombre no puede superar los 50 caracteres")
    .trim(),
  description: z
    .string()
    .max(255, "La descripción es muy larga")
    .optional()
    .nullable(),
  icon: z.string().max(30, "Icono demasiado largo").default("Tag"),
});

// ✅ GET: Obtener categorías activas
router.get("/", verifyToken, async (req, res) => {
  try {
    const sql = `
      SELECT 
        id, 
        name, 
        COALESCE(description, '') as description, 
        COALESCE(icon, 'Tag') as icon,
        COALESCE(is_active, true) as is_active, 
        created_at 
      FROM categories 
      WHERE COALESCE(is_active, true) = true 
      ORDER BY name ASC
    `;
    const result = await pool.query(sql);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Error GET categories:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ✅ POST: Crear categoría (con validación Zod)
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    // Validar entrada
    const parsed = categorySchema.parse(req.body);
    const { name, description, icon } = parsed;
    const userId = req.user?.id || req.user?.userId;

    const cleanName = name.trim();
    const existingCategory = await pool.query(
      "SELECT id, is_active FROM categories WHERE name = $1",
      [cleanName],
    );

    if (existingCategory.rows.length > 0) {
      const category = existingCategory.rows[0];
      if (category.is_active) {
        return res.status(409).json({
          success: false,
          message: "Ya existe una categoría activa con ese nombre",
        });
      } else {
        const result = await pool.query(
          `UPDATE categories 
           SET description = $1, icon = $2, is_active = true 
           WHERE id = $3 
           RETURNING id, name, COALESCE(description, '') as description, COALESCE(icon, 'Tag') as icon, is_active, created_at`,
          [description || null, icon, category.id],
        );
        await logAction("CATEGORY_CREATED", userId, req, {
          categoryId: category.id,
          name: cleanName,
          action: "reactivated",
        });
        return res.status(200).json({
          success: true,
          data: result.rows[0],
          message: "Categoría reactivada exitosamente",
        });
      }
    }

    const sql = `
      INSERT INTO categories (name, description, icon, is_active) 
      VALUES ($1, $2, $3, true) 
      RETURNING id, name, COALESCE(description, '') as description, COALESCE(icon, 'Tag') as icon, is_active, created_at
    `;
    const result = await pool.query(sql, [
      cleanName,
      description || null,
      icon,
    ]);
    await logAction("CATEGORY_CREATED", userId, req, {
      categoryId: result.rows[0].id,
      name: cleanName,
    });
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Categoría creada exitosamente",
    });
  } catch (err) {
    console.error("❌ Error POST categories:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Ya existe una categoría con ese nombre",
      });
    }
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ✅ PUT: Actualizar categoría (con validación Zod)
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "ID de categoría inválido" });
    }

    const parsed = categorySchema.parse(req.body);
    const { name, description, icon } = parsed;
    const userId = req.user?.id || req.user?.userId;
    const cleanName = name.trim();

    // Verificar nombre duplicado
    const nameExists = await pool.query(
      "SELECT id FROM categories WHERE name = $1 AND is_active = true AND id != $2",
      [cleanName, id],
    );
    if (nameExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Ya existe otra categoría activa con ese nombre",
      });
    }

    const sql = `
      UPDATE categories 
      SET name = $1, description = $2, icon = COALESCE($3, 'Tag')
      WHERE id = $4 AND is_active = true 
      RETURNING id, name, COALESCE(description, '') as description, COALESCE(icon, 'Tag') as icon, is_active, created_at
    `;
    const result = await pool.query(sql, [
      cleanName,
      description || null,
      icon,
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada o ya está desactivada",
      });
    }
    await logAction("CATEGORY_UPDATED", userId, req, {
      categoryId: id,
      name: cleanName,
      changes: { name, description, icon },
    });
    res.json({
      success: true,
      data: result.rows[0],
      message: "Categoría actualizada exitosamente",
    });
  } catch (err) {
    console.error("❌ Error PUT categories:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ✅ DELETE: Desactivar categoría (sin cambios, pero ya es seguro)
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id || req.user?.userId;

    if (!id || id.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "ID de categoría inválido" });
    }

    const checkCategory = await pool.query(
      "SELECT id, name FROM categories WHERE id = $1 AND is_active = true",
      [id],
    );
    if (checkCategory.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada o ya está desactivada",
      });
    }

    const categoryName = checkCategory.rows[0].name;
    const checkProducts = await pool.query(
      "SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = true",
      [id],
    );
    const productCount = parseInt(checkProducts.rows[0].total);

    if (productCount > 0) {
      await pool.query(
        "UPDATE products SET category_id = NULL WHERE category_id = $1 AND is_active = true",
        [id],
      );
    }

    await pool.query(
      "UPDATE categories SET is_active = false WHERE id = $1 AND is_active = true",
      [id],
    );
    await logAction("CATEGORY_DELETED", userId, req, {
      categoryId: id,
      categoryName: categoryName,
      productsUpdated: productCount,
    });
    const message =
      productCount > 0
        ? `Categoría desactivada exitosamente. ${productCount} producto(s) quedaron sin categoría.`
        : "Categoría desactivada exitosamente";
    res.json({ success: true, message, productsUpdated: productCount });
  } catch (err) {
    console.error("❌ Error DELETE categories:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
