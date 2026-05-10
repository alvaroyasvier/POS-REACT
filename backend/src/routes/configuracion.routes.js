// backend/src/routes/configuracion.routes.js
import express from "express";
import { verifyToken, isAdmin } from "../middlewares/auth.js";
import { pool } from "../config/db.js";
import { logAction } from "../services/auditService.js";
import { startBackupScheduler } from "../services/backupScheduler.js"; // ← nuevo

const router = express.Router();

const DEFAULT_CONFIG = {
  notifications: {
    lowStockThreshold: 10,
    lowStockEnabled: true,
    outOfStockEnabled: true,
    soundEnabled: false,
    autoRefresh: 30,
  },
  appearance: {
    theme: "light",
    compactMode: false,
    showProductImages: true,
    itemsPerPage: 9,
  },
  invoice: {
    companyName: "MI TIENDA POS",
    companyAddress: "Av. Principal #123, Ciudad",
    companyPhone: "📞 (555) 123-4567",
    companyEmail: "info@mitienda.com",
    companyRuc: "123456789",
    footerMessage: "¡Gracias por su compra!",
    paperSize: "80mm",
    copies: 1,
    taxRate: 19,
    showTaxInfo: true,
  },
  security: {
    sessionTimeout: 30,
    autoLogout: true,
    requirePasswordForRefund: true,
    maxLoginAttempts: 3,
    twoFactorAuth: false,
    lockoutMinutes: 15,
  },
  system: {
    currency: "EUR",
    currencySymbol: "€",
    decimalPlaces: 2,
    thousandsSeparator: ".",
    language: "es",
    dateFormat: "DD/MM/YYYY",
    timezone: "Europe/Madrid",
    // ↓↓↓ NUEVOS CAMPOS PARA BACKUPS ↓↓↓
    backupEnabled: false,
    backupSchedule: "0 2 * * *", // diario a las 2 AM
    backupRetentionDays: 30,
    backupCloudProvider: "none", // "none", "s3", "b2"
    backupCloudPath: "",
  },
  printer: {
    printerType: "thermal",
    printerPort: "USB",
    printerModel: "Epson TM-T20",
    paperWidth: 80,
    autoCut: true,
  },
};

// Obtener configuración
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT settings FROM configuraciones WHERE id = 1",
    );
    let settings = DEFAULT_CONFIG;
    if (result.rows.length > 0) {
      // Fusión profunda: mantenemos los defaults por si faltan claves nuevas
      settings = { ...DEFAULT_CONFIG, ...result.rows[0].settings };
    } else {
      // Crear registro inicial con defaults
      await pool.query(
        `INSERT INTO configuraciones (id, settings) VALUES (1, $1::jsonb)`,
        [JSON.stringify(DEFAULT_CONFIG)],
      );
    }

    // Sincronizar moneda por defecto (si existe tabla currencies)
    const currencyRes = await pool.query(
      "SELECT * FROM currencies WHERE is_default = true AND is_active = true LIMIT 1",
    );
    if (currencyRes.rows.length > 0) {
      const curr = currencyRes.rows[0];
      settings.system = {
        ...settings.system,
        currency: curr.code,
        currencySymbol: curr.symbol,
        decimalPlaces: curr.decimal_places,
        thousandsSeparator: curr.thousands_separator,
        currencyId: curr.id,
      };
    } else {
      // Intentar tomar la primera moneda activa y ponerla como default
      const anyCurr = await pool.query(
        "SELECT * FROM currencies WHERE is_active = true ORDER BY name ASC LIMIT 1",
      );
      if (anyCurr.rows.length > 0) {
        const curr = anyCurr.rows[0];
        await pool.query(
          "UPDATE currencies SET is_default = true WHERE id = $1",
          [curr.id],
        );
        settings.system = {
          ...settings.system,
          currency: curr.code,
          currencySymbol: curr.symbol,
          decimalPlaces: curr.decimal_places,
          thousandsSeparator: curr.thousands_separator,
          currencyId: curr.id,
        };
      }
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("❌ Error obteniendo configuración:", err);
    res.json({ success: true, data: DEFAULT_CONFIG }); // Fallback seguro
  }
});

// Guardar configuración (solo admin)
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const settings = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Si se está cambiando la moneda por defecto
    if (settings.system?.currencyId) {
      const { currencyId } = settings.system;
      await pool.query(
        "UPDATE currencies SET is_default = false WHERE is_default = true",
      );
      await pool.query(
        "UPDATE currencies SET is_default = true, updated_at = NOW() WHERE id = $1",
        [currencyId],
      );
      delete settings.system.currencyId; // no guardar este campo en el JSON
    }

    const existing = await pool.query(
      "SELECT id FROM configuraciones WHERE id = 1",
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE configuraciones SET settings = $1::jsonb, updated_at = NOW(), updated_by = $2 WHERE id = 1`,
        [JSON.stringify(settings), userId],
      );
    } else {
      await pool.query(
        `INSERT INTO configuraciones (id, settings, updated_by, updated_at) VALUES (1, $1::jsonb, $2, NOW())`,
        [JSON.stringify(settings), userId],
      );
    }

    // Sincronizar de nuevo la moneda para la respuesta
    const currencyRes = await pool.query(
      "SELECT * FROM currencies WHERE is_default = true AND is_active = true LIMIT 1",
    );
    if (currencyRes.rows.length > 0) {
      const curr = currencyRes.rows[0];
      settings.system = {
        ...settings.system,
        currency: curr.code,
        currencySymbol: curr.symbol,
        decimalPlaces: curr.decimal_places,
        thousandsSeparator: curr.thousands_separator,
        currencyId: curr.id,
      };
    }

    // 🔁 Reiniciar el programador de backups según la nueva configuración
    await startBackupScheduler();

    await logAction("CONFIG_UPDATED", userId, req, {
      sections: Object.keys(settings).filter((k) => k !== "system"),
      currencyChanged: !!req.body.system?.currencyId,
    });
    res.json({
      success: true,
      message: "Configuración guardada correctamente",
      data: settings,
    });
  } catch (err) {
    console.error("❌ Error guardando configuración:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// Resetear configuración
router.post("/reset", verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    await pool.query(
      `UPDATE configuraciones SET settings = $1::jsonb, updated_at = NOW(), updated_by = $2 WHERE id = 1`,
      [JSON.stringify(DEFAULT_CONFIG), userId],
    );

    // Ajustar moneda por defecto si existe
    const currencyRes = await pool.query(
      "SELECT * FROM currencies WHERE is_default = true AND is_active = true LIMIT 1",
    );
    let finalConfig = { ...DEFAULT_CONFIG };
    if (currencyRes.rows.length > 0) {
      const curr = currencyRes.rows[0];
      finalConfig.system = {
        ...finalConfig.system,
        currency: curr.code,
        currencySymbol: curr.symbol,
        decimalPlaces: curr.decimal_places,
        thousandsSeparator: curr.thousands_separator,
        currencyId: curr.id,
      };
    }

    // 🔁 Reiniciar scheduler de backups con defaults
    await startBackupScheduler();

    await logAction("CONFIG_RESET", userId, req, {});
    res.json({
      success: true,
      data: finalConfig,
      message: "Configuración restaurada a valores por defecto",
    });
  } catch (err) {
    console.error("❌ Error resetando configuración:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
