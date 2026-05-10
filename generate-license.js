// Generador de Licencias para POS REACT
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const SECRET_KEY = process.env.LICENSE_SECRET || "POS_LICENSE_SECRET_KEY_2024_ALMACEN";

const getKey = () => crypto.createHash("sha256").update(SECRET_KEY).digest();
const getIV = () => crypto.createHash("md5").update(SECRET_KEY).digest();

export const encryptData = (text) => {
  try {
    const key = getKey();
    const iv = getIV();
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  } catch (err) {
    console.error("❌ Error encriptando:", err);
    return null;
  }
};

export const generateSignature = (data) => {
  return crypto.createHmac("sha256", SECRET_KEY).update(data).digest("hex");
};

// Función para generar licencia
export const generateLicense = (customerName, daysValid = 365) => {
  // Crear fechas
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysValid);

  // Datos de la licencia
  const licenseData = {
    customerName: customerName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    maxDevices: 5,
    features: ["POS", "INVENTORY", "REPORTS", "USERS", "BACKUP"],
    createdAt: new Date().toISOString()
  };

  // Convertir a JSON y encriptar
  const jsonData = JSON.stringify(licenseData);
  console.log("\n📦 Datos de la licencia:");
  console.log(JSON.stringify(licenseData, null, 2));

  const encryptedData = encryptData(jsonData);
  if (!encryptedData) {
    console.error("❌ Error al encriptar la licencia");
    return null;
  }

  // Generar firma
  const signature = generateSignature(encryptedData);

  // Crear token final
  const token = `${encryptedData}.${signature}`;

  console.log("\n✅ LICENCIA GENERADA EXITOSAMENTE\n");
  console.log("Cliente: " + customerName);
  console.log("Válido desde: " + startDate.toLocaleDateString('es-MX'));
  console.log("Válido hasta: " + endDate.toLocaleDateString('es-MX'));
  console.log("Días de validez: " + daysValid);
  console.log("\n🔑 TOKEN DE LICENCIA:\n");
  console.log(token);
  console.log("\n" + "=".repeat(80) + "\n");

  return token;
};

// Generar licencia para Leal Distribuidora
const customerName = "Leal Distribuidora";
const daysValid = 365; // 1 año

const license = generateLicense(customerName, daysValid);

console.log("💡 INSTRUCCIONES DE USO:");
console.log("1. Copia el TOKEN de arriba (la larga cadena de caracteres)");
console.log("2. En la aplicación, ve a: Configuración > Activar Licencia");
console.log("3. Pega el token en el campo de licencia");
console.log("4. Haz clic en 'Activar'");
console.log("\n");
