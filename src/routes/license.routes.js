// backend/src/routes/license.routes.js
import express from "express";
import {
  checkSystemLicense,
  activateSystemLicense,
} from "../services/licenseService.js";
import { logAction } from "../services/auditService.js";
import { updateLicenseStatus } from "../services/licenseMonitor.js";
import {
  saveLicenseLocally,
  readLicenseLocally,
  getLicenseStatus,
} from "../services/licenseStorageService.js";

const router = express.Router();

router.get("/status", async (req, res) => {
  try {
    // Intentar desde BD primero
    try {
      const result = await checkSystemLicense();
      res.json({ success: true, data: result, source: "database" });
      return;
    } catch (dbErr) {
      console.log("⚠️ [LICENSE] No se pudo leer de BD, usando almacenamiento local...");
    }

    // Fallback: usar almacenamiento local
    const localStatus = getLicenseStatus();
    res.json({ success: true, data: localStatus, source: "local" });
  } catch (err) {
    console.error("❌ Error en /status:", err);
    res.json({
      success: false,
      status: "inactive",
      message: "No se pudo verificar la licencia",
    });
  }
});

router.post("/activate", async (req, res) => {
  try {
    let { licenseToken, customerName } = req.body;

    if (licenseToken) {
      licenseToken = licenseToken.replace(/[\s\n\r\t\u00A0]/g, "").trim();
    }

    console.log(
      "📦 [LICENSE ROUTE] Token recibido:",
      licenseToken?.substring(0, 30) + "...",
    );

    if (!licenseToken) {
      await logAction("LICENSE_ACTIVATE_FAILED", null, req, {
        reason: "missing_token",
      });
      return res
        .status(400)
        .json({ success: false, message: "Token requerido" });
    }

    // Intentar activar con BD primero
    const result = await activateSystemLicense(licenseToken, customerName);

    if (result.success) {
      await updateLicenseStatus();

      await logAction("LICENSE_ACTIVATED", null, req, {
        customerName: result.data.customerName,
        plan: result.data.plan,
        startDate: result.data.startDate,
        endDate: result.data.endDate,
      });
      res.json({ success: true, data: result.data, storage: "database" });
    } else {
      // Si falla la BD, intentar guardar localmente como fallback
      console.log("⚠️ [LICENSE] BD falló, intentando almacenamiento local...");
      const localSave = saveLicenseLocally(licenseToken, customerName);

      if (localSave.success) {
        console.log(
          "✅ [LICENSE] Licencia guardada localmente como fallback",
        );
        res.json({
          success: true,
          message: "Licencia activada (almacenamiento local)",
          storage: "local",
        });
      } else {
        await logAction("LICENSE_ACTIVATE_FAILED", null, req, {
          reason: result.message,
          tokenPrefix: licenseToken.substring(0, 10) + "...",
        });
        res.status(400).json({
          success: false,
          message:
            result.message || "Error al activar la licencia",
        });
      }
    }
  } catch (err) {
    console.error("❌ Error en /activate:", err);
    
    // Último recurso: guardar localmente de todas formas
    try {
      const localBackup = saveLicenseLocally(
        req.body.licenseToken || "",
        req.body.customerName || "Cliente",
      );
      if (localBackup.success) {
        res.json({
          success: true,
          message: "Licencia activada (modo de recuperación)",
          storage: "local_backup",
        });
        return;
      }
    } catch (e) {
      console.error("❌ Fallback también falló:", e.message);
    }

    await logAction("LICENSE_ACTIVATE_ERROR", null, req, {
      error: err.message,
    });
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

export default router;
