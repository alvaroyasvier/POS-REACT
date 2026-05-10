// backend/src/models/Configuracion.js
const db = require("../config/database");

class Configuracion {
  // Obtener configuración
  static async get(userId, isAdmin = false) {
    let query;
    let params;

    if (isAdmin) {
      // Admin puede ver configuración global (user_id IS NULL)
      query = "SELECT * FROM configuraciones WHERE user_id IS NULL LIMIT 1";
      params = [];
    } else {
      // Usuario normal ve su configuración personal o la global
      query =
        "SELECT * FROM configuraciones WHERE user_id = $1 OR user_id IS NULL ORDER BY user_id DESC LIMIT 1";
      params = [userId];
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return this.getDefault();
    }

    return result.rows[0];
  }

  // Guardar configuración - Solo admin puede modificar configuración global
  static async save(userId, settings) {
    // Verificar si ya existe configuración global
    const existing = await db.query(
      "SELECT id FROM configuraciones WHERE user_id IS NULL",
    );

    if (existing.rows.length > 0) {
      // Actualizar configuración global
      const result = await db.query(
        `UPDATE configuraciones 
         SET settings = $1, updated_at = NOW() 
         WHERE user_id IS NULL 
         RETURNING *`,
        [JSON.stringify(settings)],
      );
      return result.rows[0];
    } else {
      // Crear configuración global
      const result = await db.query(
        `INSERT INTO configuraciones (user_id, settings, created_at, updated_at) 
         VALUES (NULL, $1, NOW(), NOW()) 
         RETURNING *`,
        [JSON.stringify(settings)],
      );
      return result.rows[0];
    }
  }

  // Configuración por defecto
  static getDefault() {
    return {
      id: null,
      user_id: null,
      settings: {
        notifications: {
          lowStockThreshold: 10,
          lowStockEnabled: true,
          outOfStockEnabled: true,
          soundEnabled: false,
          autoRefresh: 30,
        },
        appearance: {
          theme: "light",
          compactMode: false,
          showProductImages: true,
          itemsPerPage: 9,
        },
        invoice: {
          companyName: "MI TIENDA POS",
          companyAddress: "Av. Principal #123, Ciudad",
          companyPhone: "📞 (555) 123-4567",
          companyEmail: "info@mitienda.com",
          companyRuc: "123456789",
          footerMessage: "¡Gracias por su compra!",
          paperSize: "80mm",
          copies: 1,
          taxRate: 19,
        },
        security: {
          sessionTimeout: 30,
          autoLogout: true,
          requirePasswordForRefund: true,
          maxLoginAttempts: 3,
        },
        system: {
          currency: "USD",
          currencySymbol: "$",
          language: "es",
          dateFormat: "DD/MM/YYYY",
          timezone: "America/Santiago",
        },
        printer: {
          printerType: "thermal",
          printerPort: "USB",
          printerModel: "Epson TM-T20",
          paperWidth: 80,
          autoCut: true,
        },
      },
      created_at: new Date(),
      updated_at: new Date(),
    };
  }
}

module.exports = Configuracion;
