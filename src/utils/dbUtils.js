// backend/src/utils/dbUtils.js
import { pool } from '../config/db.js';

export async function getBackupSettings() {
  try {
    const res = await pool.query('SELECT settings FROM configuraciones WHERE id = 1');
    const system = res.rows[0]?.settings?.system || {};
    return {
      backupEnabled: system.backupEnabled ?? false,
      backupSchedule: system.backupSchedule || '0 2 * * *',
      backupRetentionDays: system.backupRetentionDays || 30,
      backupCloudProvider: system.backupCloudProvider || 'none',
      backupCloudPath: system.backupCloudPath || ''
    };
  } catch (err) {
    console.error('Error al leer configuración de backup:', err);
    return {
      backupEnabled: false,
      backupSchedule: '0 2 * * *',
      backupRetentionDays: 30,
      backupCloudProvider: 'none',
      backupCloudPath: ''
    };
  }
}