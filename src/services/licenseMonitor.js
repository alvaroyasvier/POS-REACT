// backend/src/services/licenseMonitor.js
import { checkSystemLicense } from "./licenseService.js";

let licenseStatus = {
  valid: false,
  data: null,
  lastCheck: null,
};

// ✅ Actualizar estado inmediatamente y luego cada 5 minutos
export const startLicenseMonitor = async () => {
  await updateLicenseStatus();
  setInterval(updateLicenseStatus, 5 * 60 * 1000);
};

export const updateLicenseStatus = async () => {
  try {
    const result = await checkSystemLicense();
    licenseStatus = {
      valid: result.valid,
      data: result.data,
      lastCheck: new Date(),
    };

    if (!result.valid) {
      console.warn(`⚠️ Licencia inválida: ${result.reason}`);
      if (result.reason === "clock_tampered") {
        console.error("🔴 BLOQUEO POR MANIPULACIÓN DE FECHA");
      }
    } else {
      console.log(
        `✅ Licencia activa. Cliente: ${result.data?.customerName}, Días restantes: ${result.data?.daysLeft}`,
      );
    }
  } catch (err) {
    console.error("❌ Error en monitor de licencia:", err);
  }
};

// ✅ Obtener estado actual (cache)
export const getCurrentLicenseStatus = () => licenseStatus;
