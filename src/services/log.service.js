import { pool } from '../config/db.js';

export async function logAction(userId, action, details = {}) {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [userId, action, JSON.stringify(details)]
    );
  } catch (err) { console.error('📝 Error guardando log:', err.message); }
}