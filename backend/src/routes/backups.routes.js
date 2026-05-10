// backend/src/routes/backups.routes.js
import express from 'express';
import { z } from 'zod';
import { verifyToken, requireRole } from '../middlewares/auth.js';
import { performBackup } from '../services/backupService.js';
import { pool } from '../config/db.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Ejecutar backup manual
router.post('/run', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await performBackup(true);
    if (result.success) {
      res.json({ success: true, message: 'Backup creado exitosamente', file: result.file });
    } else {
      res.status(500).json({ success: false, message: result.error || 'Error desconocido' });
    }
  } catch (err) {
    console.error('Error en POST /run:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// Listar backups existentes
router.get('/list', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, file_name, size, manual, created_at FROM backups ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error en GET /list:', err);
    res.status(500).json({ success: false, message: 'Error al listar backups' });
  }
});

// Descargar un backup específico (bajo autenticación)
router.get('/download/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT file_path, file_name FROM backups WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado' });

    const filePath = rows[0].file_path;
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Archivo no existe' });

    res.download(filePath, rows[0].file_name);
  } catch (err) {
    console.error('Error en GET /download:', err);
    res.status(500).json({ success: false, message: 'Error al descargar' });
  }
});

// Eliminar un backup (opcional)
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT file_path FROM backups WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'No encontrado' });

    try {
      fs.unlinkSync(rows[0].file_path);
    } catch (e) {}

    await pool.query('DELETE FROM backups WHERE id = $1', [id]);
    res.json({ success: true, message: 'Backup eliminado' });
  } catch (err) {
    console.error('Error en DELETE /:id:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar' });
  }
});

export default router;