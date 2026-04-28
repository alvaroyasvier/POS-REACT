// backend/src/services/auditService.js
import { pool } from "../config/db.js";

// Registra una acción en el log de auditoría
export const logAction = async (action, userId, req, details = {}) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      null;
    const userAgent = req.headers["user-agent"] || null;

    await pool.query(
      `INSERT INTO audit_logs (action, user_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, userId, ip, userAgent, JSON.stringify(details)],
    );
  } catch (err) {
    console.error("❌ Error registrando auditoría:", err.message);
  }
};

// Obtiene logs paginados
export const getAuditLogs = async (limit = 100, offset = 0) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  } catch (err) {
    console.error("❌ Error obteniendo logs:", err.message);
    return [];
  }
};

// Elimina logs antiguos (más de X días)
export const cleanOldLogs = async (days = 90) => {
  try {
    const result = await pool.query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${days} days'`,
    );
    return result.rowCount;
  } catch (err) {
    console.error("❌ Error limpiando logs antiguos:", err.message);
    return 0;
  }
};

// Inicia la limpieza automática cada 24 horas
export const startLogCleanup = () => {
  setInterval(
    async () => {
      try {
        const deleted = await cleanOldLogs(90);
        if (deleted > 0)
          console.log(`🧹 Limpiados ${deleted} logs antiguos (más de 90 días)`);
      } catch (err) {
        console.error("Error en limpieza de logs:", err);
      }
    },
    24 * 60 * 60 * 1000,
  ); // 24 horas
  console.log("✅ Limpieza automática de logs programada (cada 24h)");
};
