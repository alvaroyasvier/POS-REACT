// src/utils/cryptoUtils.js
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz (subiendo dos niveles: utils -> src -> raíz)
dotenv.config({ path: path.join(__dirname, "../../.env") });

const SECRET_KEY = process.env.LICENSE_SECRET || "POS-SYSTEM-SECRET-KEY-2024";

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

export const decryptData = (encrypted) => {
  try {
    let base64 = encrypted.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const key = getKey();
    const iv = getIV();
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(base64, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("❌ Error desencriptando:", err);
    return null;
  }
};

export const generateSignature = (data) => {
  return crypto.createHmac("sha256", SECRET_KEY).update(data).digest("hex");
};

export const verifySignature = (data, signature) => {
  const expected = generateSignature(data);
  return expected === signature;
};
