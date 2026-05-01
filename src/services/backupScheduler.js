// backend/src/services/backupScheduler.js
import cron from 'node-cron';
import { performBackup } from './backupService.js';
import { getBackupSettings } from '../utils/dbUtils.js';

let currentTask = null;

export async function startBackupScheduler() {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  try {
    const settings = await getBackupSettings();
    if (!settings.backupEnabled) {
      console.log('Backup automático desactivado');
      return;
    }

    if (cron.validate(settings.backupSchedule)) {
      currentTask = cron.schedule(settings.backupSchedule, () => {
        performBackup(false).then(res => {
          if (res.success) console.log('Backup automático completado:', res.file);
          else console.error('Fallo en backup automático:', res.error || res.reason);
        });
      });
      console.log(`Backup programado: ${settings.backupSchedule}`);
    } else {
      console.error('Expresión cron inválida:', settings.backupSchedule);
    }
  } catch (error) {
    console.error('Error al iniciar scheduler de backup:', error);
  }
}