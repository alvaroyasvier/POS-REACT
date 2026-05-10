// License storage service - works with or without DB
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LICENSES_DIR = path.join(__dirname, "../../licenses");
const LICENSE_FILE = path.join(LICENSES_DIR, "system.license.json");

// Crear directorio si no existe
if (!fs.existsSync(LICENSES_DIR)) {
  fs.mkdirSync(LICENSES_DIR, { recursive: true });
  console.log("📁 Directorio de licencias creado:", LICENSES_DIR);
}

export const saveLicenseLocally = (licenseToken, customerName) => {
  try {
    const licenseData = {
      token: licenseToken,
      customerName: customerName,
      activatedAt: new Date().toISOString(),
      machineInfo: {
        platform: process.platform,
        hostname: require("os").hostname(),
        arch: process.arch,
      },
    };

    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenseData, null, 2));
    console.log("✅ [LICENSE] Licencia guardada localmente en:", LICENSE_FILE);
    return { success: true, saved: true };
  } catch (err) {
    console.error("❌ [LICENSE] Error guardando localmente:", err.message);
    return { success: false, error: err.message };
  }
};

export const readLicenseLocally = () => {
  try {
    if (!fs.existsSync(LICENSE_FILE)) {
      return { success: false, found: false };
    }

    const data = fs.readFileSync(LICENSE_FILE, "utf8");
    const licenseData = JSON.parse(data);
    console.log("✅ [LICENSE] Licencia leída localmente");
    return { success: true, found: true, data: licenseData };
  } catch (err) {
    console.error("❌ [LICENSE] Error leyendo licencia local:", err.message);
    return { success: false, error: err.message };
  }
};

export const deleteLicenseLocally = () => {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      fs.unlinkSync(LICENSE_FILE);
      console.log("✅ [LICENSE] Licencia local eliminada");
      return { success: true };
    }
    return { success: false, notFound: true };
  } catch (err) {
    console.error("❌ [LICENSE] Error eliminando licencia local:", err.message);
    return { success: false, error: err.message };
  }
};

export const getLicenseStatus = () => {
  const local = readLicenseLocally();
  if (local.success && local.found) {
    return {
      status: "active",
      source: "local",
      data: local.data,
    };
  }
  return {
    status: "inactive",
    source: "none",
    message: "No license found",
  };
};
