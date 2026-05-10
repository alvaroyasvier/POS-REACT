// backend/src/routes/products.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { upload } from "../config/multer.js";
import { logAction } from "../services/auditService.js";

const router = express.Router();

// ✅ Esquemas de validación Zod
const createProductSchema = z.object({
  sku: z.string().min(1, "SKU requerido").max(50, "SKU muy largo").trim(),
  name: z
    .string()
    .min(1, "Nombre requerido")
    .max(100, "Nombre muy largo")
    .trim(),
  cost_price: z.coerce.number().min(0, "Precio de costo inválido"),
  sale_price: z.coerce.number().min(0, "Precio de venta inválido"),
  stock: z.coerce.number().int().min(0, "Stock inválido"),
  category_id: z.string().uuid().optional().nullable(),
});

const updateProductSchema = createProductSchema.partial().extend({
  category_id: z.string().uuid().optional().nullable().or(z.literal("")),
});

// ✅ GET: Listar productos (sin cambios relevantes)
router.get("/", verifyToken, async (req, res) => {
  try {
    const tableExists = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')`,
    );
    const hasCategories = tableExists.rows[0].exists;

    const sql = hasCategories
      ? `SELECT p.id, p.sku, p.name, p.cost_price, p.sale_price, p.stock, p.category_id, p.image_url, p.is_active, p.created_at, COALESCE(c.name, 'Sin categoría') AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = true ORDER BY p.name ASC`
      : `SELECT p.id, p.sku, p.name, p.cost_price, p.sale_price, p.stock, p.category_id, p.image_url, p.is_active, p.created_at, 'Sin categoría' AS category_name FROM products p WHERE p.is_active = true ORDER BY p.name ASC`;

    const result = await pool.query(sql);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Error GET /products:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ✅ POST: Crear producto (con Zod + ocultar error)
router.post(
  "/",
  verifyToken,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      // Validar entrada
      const parsed = createProductSchema.parse(req.body);
      const { sku, name, cost_price, sale_price, stock, category_id } = parsed;
      const image_url = req.file ? "/uploads/" + req.file.filename : null;
      const userId = req.user?.id || req.user?.userId;

      const columns = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'user_id'`,
      );
      const hasUserId = columns.rows.length > 0;

      let sql, values;
      if (hasUserId) {
        sql = `INSERT INTO products (sku, name, cost_price, sale_price, stock, category_id, image_url, user_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`;
        values = [
          sku.trim(),
          name.trim(),
          parseFloat(cost_price),
          parseFloat(sale_price),
          parseInt(stock),
          category_id || null,
          image_url,
          userId,
        ];
      } else {
        sql = `INSERT INTO products (sku, name, cost_price, sale_price, stock, category_id, image_url, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`;
        values = [
          sku.trim(),
          name.trim(),
          parseFloat(cost_price),
          parseFloat(sale_price),
          parseInt(stock),
          category_id || null,
          image_url,
        ];
      }

      const result = await pool.query(sql, values);
      await logAction("PRODUCT_CREATED", userId, req, {
        productId: result.rows[0].id,
        name: name.trim(),
        sku: sku.trim(),
      });
      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: "Producto creado",
      });
    } catch (err) {
      console.error("❌ Error POST /products:", err);
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
          .json({ success: false, message: "SKU duplicado" });
      }
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// ✅ PUT /:id/stock - Ajuste de stock CON TRANSACCIÓN
router.put(
  "/:id/stock",
  verifyToken,
  requireRole("warehouse", "admin"),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { quantity, action, reason } = req.body;

      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Cantidad inválida" });
      }
      if (!["increase", "decrease"].includes(action)) {
        return res
          .status(400)
          .json({ success: false, message: "Acción inválida" });
      }

      await client.query("BEGIN");

      const productRes = await client.query(
        "SELECT id, name, sku, stock FROM products WHERE id = $1::uuid AND is_active = true",
        [id],
      );
      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, message: "Producto no encontrado" });
      }

      const product = productRes.rows[0];
      let newStock;
      if (action === "increase") {
        newStock = product.stock + qty;
      } else {
        if (product.stock < qty) {
          await client.query("ROLLBACK");
          return res
            .status(400)
            .json({ success: false, message: "Stock insuficiente" });
        }
        newStock = product.stock - qty;
      }

      await client.query(
        "UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2::uuid",
        [newStock, id],
      );

      const userId = req.user?.id || req.user?.userId;
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) 
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)`,
        [id, qty, action, reason || "Ajuste manual", userId],
      );

      await client.query("COMMIT");

      await logAction(
        action === "increase" ? "STOCK_INCREASE" : "STOCK_DECREASE",
        userId,
        req,
        {
          productId: id,
          quantity: qty,
          previousStock: product.stock,
          newStock,
        },
      );

      res.json({
        success: true,
        message: `Se ${action === "increase" ? "agregaron" : "retiraron"} ${qty} unidades`,
        data: { id, name: product.name, stock: newStock },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Error en actualización de stock:", err);
      // ✅ Ahora solo mensaje genérico
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    } finally {
      client.release();
    }
  },
);

// ✅ PUT: Actualizar producto completo (con Zod)
router.put(
  "/:id",
  verifyToken,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      // Validar entrada
      const parsed = updateProductSchema.parse(req.body);
      const { sku, name, cost_price, sale_price, stock, category_id } = parsed;

      const updates = [];
      const values = [];
      let idx = 1;
      const push = (field, value) => {
        if (value !== undefined && value !== null && value !== "") {
          updates.push(`${field} = $${idx}`);
          values.push(value);
          idx++;
        }
      };

      if (sku) push("sku", sku.trim());
      if (name) push("name", name.trim());
      if (cost_price !== undefined) push("cost_price", parseFloat(cost_price));
      if (sale_price !== undefined) push("sale_price", parseFloat(sale_price));
      if (stock !== undefined && stock !== "") push("stock", parseInt(stock));
      if (category_id !== undefined) {
        if (category_id === "" || category_id === "null") {
          updates.push(`category_id = $${idx}`);
          values.push(null);
          idx++;
        } else {
          push("category_id", category_id);
        }
      }
      if (req.file) push("image_url", "/uploads/" + req.file.filename);
      updates.push("updated_at = NOW()");

      if (updates.length === 1) {
        return res
          .status(400)
          .json({ success: false, message: "No hay datos para actualizar" });
      }

      values.push(id);
      const sql = `UPDATE products SET ${updates.join(", ")} WHERE id = $${idx} AND is_active = true RETURNING *`;
      const result = await pool.query(sql, values);

      if (result.rows.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "Producto no encontrado" });

      const userId = req.user?.id || req.user?.userId;
      await logAction("PRODUCT_UPDATED", userId, req, {
        productId: id,
        changes: req.body,
      });
      res.json({
        success: true,
        data: result.rows[0],
        message: "Producto actualizado",
      });
    } catch (err) {
      console.error("❌ Error PUT /:id:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos",
          errors: err.errors.map((e) => e.message),
        });
      }
      if (err.code === "23505") {
        return res.status(409).json({ success: false, message: "SKU en uso" });
      }
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// ✅ DELETE: Desactivar producto
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1",
      [id],
    );
    const userId = req.user?.id || req.user?.userId;
    await logAction("PRODUCT_DELETED", userId, req, { productId: id });
    res.json({ success: true, message: "Producto desactivado" });
  } catch (err) {
    console.error("❌ Error DELETE /:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
