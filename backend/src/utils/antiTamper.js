// backend/src/utils/antiTamper.js
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lista de archivos críticos a verificar (rutas relativas desde la raíz del proyecto)
const CRITICAL_FILES = [
  "src/routes/auth.routes.js",
  "src/routes/users.routes.js",
  "src/middlewares/auth.js",
  "src/services/licenseService.js",
  "src/server.js",
];

// ============================================================================
// 1. Detección de debugger mejorada (no solo time-based)
// ============================================================================
export const detectDebugger = () => {
  // Método 1: Verificar si el proceso fue lanzado con --inspect
  if (process.execArgv.some(arg => arg.includes("--inspect") || arg.includes("--debug"))) {
    return true;
  }
  // Método 2: Verificar variables de entorno de depuración
  if (process.env.NODE_OPTIONS?.includes("--inspect") || process.env.NODE_OPTIONS?.includes("--debug")) {
    return true;
  }
  // Método 3: Time-based (poco fiable pero complementario)
  const start = Date.now();
  // Este debugger; solo afecta si hay depurador activo
  debugger;
  const diff = Date.now() - start;
  return diff > 50;
};

// ============================================================================
// 2. Verificar integridad de archivos (hash)
// ============================================================================
const getFileHash = (filePath) => {
  try {
    const fullPath = path.join(__dirname, "..", "..", filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath);
    return crypto.createHash("sha256").update(content).digest("hex");
  } catch (err) {
    console.error(`❌ Error al leer archivo ${filePath}:`, err.message);
    return null;
  }
};

// Almacenar hashes conocidos (se guardan en un archivo la primera vez)
const HASH_STORAGE_PATH = path.join(__dirname, "..", "..", ".integrity.json");
let expectedHashes = {};

const loadExpectedHashes = () => {
  if (fs.existsSync(HASH_STORAGE_PATH)) {
    try {
      const data = fs.readFileSync(HASH_STORAGE_PATH, "utf8");
      expectedHashes = JSON.parse(data);
    } catch (err) {
      console.error("❌ Error cargando hashes de integridad:", err);
    }
  }
};

const saveExpectedHashes = () => {
  try {
    fs.writeFileSync(HASH_STORAGE_PATH, JSON.stringify(expectedHashes, null, 2));
  } catch (err) {
    console.error("❌ Error guardando hashes de integridad:", err);
  }
};

export const verifyIntegrity = (silent = false) => {
  let allGood = true;
  for (const file of CRITICAL_FILES) {
    const currentHash = getFileHash(file);
    if (!currentHash) {
      if (!silent) console.warn(`⚠️ No se pudo verificar integridad de ${file}`);
      continue;
    }
    if (!expectedHashes[file]) {
      // Primera ejecución: almacenar hash como esperado
      expectedHashes[file] = currentHash;
      if (!silent) console.log(`🔐 Registrando hash para ${file}`);
    } else if (expectedHashes[file] !== currentHash) {
      console.error(`🚨 INTEGRIDAD COMPROMETIDA: ${file} ha sido modificado!`);
      allGood = false;
    }
  }
  if (!silent && allGood) console.log("✅ Verificación de integridad de archivos exitosa");
  return allGood;
};

// ============================================================================
// 3. Verificar variables de entorno peligrosas
// ============================================================================
export const verifyEnvironment = () => {
  const issues = [];
  // NODE_ENV no debe ser 'development' en producción
  if (process.env.NODE_ENV === "development" && process.env.NODE_ENV !== "production") {
    // No es un problema, solo advertencia
    console.log("ℹ️ Modo desarrollo - algunas verificaciones de seguridad menos estrictas");
  }
  // Verificar que JWT_SECRET y LICENSE_SECRET existan (esto ya se hace en otros módulos)
  if (!process.env.JWT_SECRET) issues.push("JWT_SECRET no definida");
  if (!process.env.LICENSE_SECRET) issues.push("LICENSE_SECRET no definida");
  // Verificar que no haya fallos de variable de entorno
  if (issues.length) {
    console.warn("⚠️ Advertencias de entorno:", issues.join(", "));
  }
  return issues;
};

// ============================================================================
// 4. Iniciar monitor anti-tampering
// ============================================================================
export const startAntiTamperMonitor = () => {
  // Cargar hashes esperados
  loadExpectedHashes();

  // Verificar integridad al inicio
  const integrityOk = verifyIntegrity(false);
  if (!integrityOk) {
    console.error("🛑 Integridad comprometida. Deteniendo el servidor por seguridad.");
    process.exit(1);
  }
  // Guardar los hashes (si es primera ejecución)
  saveExpectedHashes();

  // Verificar entorno
  verifyEnvironment();

  // Verificar debugger periódicamente (cada 5 minutos)
  setInterval(() => {
    if (detectDebugger()) {
      console.error("🔴 DEBUGGER DETECTADO - Posible manipulación");
      // Opcional: cerrar proceso o solo registrar
      // process.exit(1);
    }
  }, 5 * 60 * 1000);
};