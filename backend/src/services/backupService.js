// backend/src/services/backupService.js
import { exec } from 'child_process';
import { createWriteStream, createReadStream, unlinkSync, statSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { createGzip } from 'zlib';
import crypto from 'crypto';
import { pool } from '../config/db.js';
import { getBackupSettings } from '../utils/dbUtils.js';

const BACKUP_DIR = process.env.BACKUP_DIR || 'C:/backups/pos';

// Ejecuta comando shell. Ahora le pasamos un entorno que incluye PGPASSWORD
const execPromise = (cmd, envOverride = {}) => new Promise((resolve, reject) => {
  const env = { ...process.env, ...envOverride };
  exec(cmd, { timeout: 60000, env }, (error, stdout, stderr) => {
    if (error) reject(error);
    else resolve(stdout);
  });
});

// Cifra archivo usando AES-256-GCM
async function encryptFile(inputPath, outputPath, key) {
  return new Promise((resolve, reject) => {
    const keyBuffer = Buffer.from(key.slice(0, 64), 'hex');
    const iv = Buffer.from(key.slice(64, 96), 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);
    input.pipe(cipher).pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
  });
}

// Comprime archivo con gzip
async function compressFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const input = createReadStream(inputPath);
    const gzip = createGzip();
    const output = createWriteStream(outputPath);
    input.pipe(gzip).pipe(output);
    output.on('finish', resolve);
    output.on('error', reject);
  });
}

// Realiza el backup completo
export async function performBackup(manual = false) {
  const settings = await getBackupSettings();
  if (!settings.backupEnabled && !manual) {
    return { success: false, reason: 'disabled' };
  }

  // Asegurar que el directorio de backups existe
  if (!existsSync(BACKUP_DIR)) {
    try {
      mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`Directorio de backups creado: ${BACKUP_DIR}`);
    } catch (dirErr) {
      console.error('Error creando directorio:', dirErr);
      return { success: false, error: `No se pudo crear el directorio ${BACKUP_DIR}` };
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpFile = path.join(BACKUP_DIR, `dump_${timestamp}.sql`);
  const zipFile = dumpFile + '.gz';
  const encFile = zipFile + '.enc';

  try {
    // 1. Obtener variables limpias
    const pgDumpPath = (process.env.PGDUMP_PATH || 'pg_dump').trim();
    const dbUser = (process.env.DB_USER || 'postgres').trim();
    const dbHost = (process.env.DB_HOST || '127.0.0.1').trim();
    const dbName = (process.env.DB_NAME || 'pos_db').trim();
    const dbPassword = (process.env.PGPASSWORD || '').trim();

    // Si no hay contraseña, no podemos continuar (aunque pg_dump podría usar otros métodos)
    if (!dbPassword) {
      console.warn('⚠️ No se ha definido PGPASSWORD. El backup puede fallar si la base requiere contraseña.');
    }

    // Construir comando sin "set", pasaremos la contraseña como variable de entorno
    const dumpCmd = `"${pgDumpPath}" -U ${dbUser} -h ${dbHost} ${dbName} > "${dumpFile}"`;
    console.log('Ejecutando comando de backup:', dumpCmd);
    
    // Pasar PGPASSWORD en el entorno del subproceso
    const envVars = dbPassword ? { PGPASSWORD: dbPassword } : {};
    await execPromise(dumpCmd, envVars);

    // 2. Comprimir
    await compressFile(dumpFile, zipFile);
    unlinkSync(dumpFile);

    // 3. Cifrar
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY?.trim();
    if (!encryptionKey) throw new Error('BACKUP_ENCRYPTION_KEY no definida');
    await encryptFile(zipFile, encFile, encryptionKey);
    unlinkSync(zipFile);

    // 4. Registrar en BD
    const fileSize = statSync(encFile).size;
    await pool.query(
      `INSERT INTO backups (file_name, file_path, size, manual, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [path.basename(encFile), encFile, fileSize, manual]
    );

    // 5. Rotación
    if (settings.backupRetentionDays > 0) {
      await removeOldBackups(settings.backupRetentionDays);
    }

    // 6. Nube (placeholder)
    if (settings.backupCloudProvider && settings.backupCloudProvider !== 'none') {
      await uploadToCloud(encFile, settings);
    }

    return { success: true, file: path.basename(encFile) };
  } catch (error) {
    console.error('Error en backup:', error);
    return { success: false, error: error.message };
  }
}

async function removeOldBackups(retentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `SELECT id, file_path FROM backups WHERE manual = false AND created_at < $1`,
    [cutoff]
  );
  for (const row of rows) {
    try {
      unlinkSync(row.file_path);
      await pool.query(`DELETE FROM backups WHERE id = $1`, [row.id]);
    } catch (e) {
      console.error(`Error al eliminar backup ${row.file_path}:`, e);
    }
  }
}

async function uploadToCloud(filePath, settings) {
  console.log(`Subida a nube no implementada. Archivo: ${filePath}`);
}