// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

// ✅ Validar variables de entorno
dotenv.config();
import { checkEnv } from "./src/config/envCheck.js";
checkEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// ============================================================================
// SEGURIDAD Y MIDDLEWARES
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ],
        connectSrc: [
          "'self'",
          "http://localhost:3000",
          "http://localhost:5173",
          "http://127.0.0.1:3000",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  message: { success: false, message: "Demasiadas peticiones" },
  skip: (req) =>
    [
      "/api/license/status",
      "/api/health",
      "/api/auth/update-activity",
      "/api/products",
      "/uploads",
    ].some((p) => req.path.startsWith(p)),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/license/activate", authLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================================
// MULTER (imágenes)
// ============================================================================
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(
      null,
      "img-" +
        Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname),
    ),
});

const fileFilter = (req, file, cb) => {
  const ok = /jpe?g|png|webp|gif/i.test(file.mimetype);
  cb(ok ? null : new Error("Solo imágenes"), ok);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(uploadDir),
);
console.log(`📁 Imágenes subidas en: ${uploadDir}`);

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/api/health", (req, res) =>
  res.json({ success: true, message: "API OK" }),
);

// ============================================================================
// IMPORTAR RUTAS (asíncrono)
// ============================================================================
const importRoute = async (routePath, routeName) => {
  try {
    const mod = await import(routePath);
    if (!mod?.default) throw new Error("No exporta router");
    console.log(`✅ Ruta cargada: ${routeName}`);
    return mod.default;
  } catch (err) {
    console.error(`❌ Error cargando ${routeName}:`, err.message);
    const router = express.Router();
    router.use((req, res) =>
      res
        .status(503)
        .json({ success: false, message: `${routeName} no disponible` }),
    );
    return router;
  }
};

(async () => {
  try {
    const [
      authRoutes,
      productRoutes,
      categoryRoutes,
      saleRoutes,
      userRoutes,
      reportRoutes,
      logRoutes,
      configuracionRoutes,
      licenseRoutes,
      cashRoutes,
      currenciesRoutes,
      refundRoutes,
      invoicesRoutes,
      creditNotesRoutes,
      backupRoutes, // ← NUEVO
    ] = await Promise.all([
      importRoute("./src/routes/auth.routes.js", "auth"),
      importRoute("./src/routes/products.routes.js", "products"),
      importRoute("./src/routes/categories.routes.js", "categories"),
      importRoute("./src/routes/sales.routes.js", "sales"),
      importRoute("./src/routes/users.routes.js", "users"),
      importRoute("./src/routes/reports.routes.js", "reports"),
      importRoute("./src/routes/logs.routes.js", "logs"),
      importRoute("./src/routes/configuracion.routes.js", "configuracion"),
      importRoute("./src/routes/license.routes.js", "license"),
      importRoute("./src/routes/cash.routes.js", "cash"),
      importRoute("./src/routes/currencies.routes.js", "currencies"),
      importRoute("./src/routes/refunds.routes.js", "refunds"),
      importRoute("./src/routes/invoices.routes.js", "invoices"),
      importRoute("./src/routes/creditNotes.routes.js", "creditNotes"),
      importRoute("./src/routes/backups.routes.js", "backups"), // ← NUEVO
    ]);

    const { requireLicense } =
      await import("./src/middlewares/licenseMiddleware.js");
    const { startLicenseMonitor } =
      await import("./src/services/licenseMonitor.js");
    const { startLogCleanup } = await import("./src/services/auditService.js");
    const { startBackupScheduler } =
      await import("./src/services/backupScheduler.js"); // ← NUEVO

    // Rutas públicas
    app.use("/api/auth", authRoutes);
    app.use("/api/license", licenseRoutes);
    app.get("/api/health", (req, res) => res.json({ success: true }));

    // Middleware de licencia (protege el resto de rutas)
    app.use("/api", requireLicense);

    // Rutas protegidas
    app.use("/api/products", productRoutes);
    app.use("/api/categories", categoryRoutes);
    app.use("/api/sales", saleRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/reports", reportRoutes);
    app.use("/api/logs", logRoutes);
    app.use("/api/configuracion", configuracionRoutes);
    app.use("/api/cash", cashRoutes);
    app.use("/api/currencies", currenciesRoutes);
    app.use("/api/refunds", refundRoutes);
    app.use("/api/invoices", invoicesRoutes);
    app.use("/api/credit-notes", creditNotesRoutes);
    app.use("/api/backups", backupRoutes); // ← NUEVO

    // ============================================================================
    // SERVIDOR DE FRONTEND ESTÁTICO
    // ============================================================================
    const distPath = path.join(__dirname, "frontend", "dist");
    if (fs.existsSync(distPath)) {
      console.log(`📁 Sirviendo frontend desde: ${distPath}`);
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (!req.originalUrl.startsWith("/api")) {
          res.sendFile(path.join(distPath, "index.html"));
        } else {
          next();
        }
      });
    } else {
      console.warn(
        "⚠️ Frontend no construido. Ejecuta 'npm run build' en frontend",
      );
    }

    // ============================================================================
    // MANEJO DE ERRORES
    // ============================================================================
    app.use((req, res) => {
      if (req.originalUrl.startsWith("/api")) {
        res.status(404).json({
          success: false,
          message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        });
      } else if (fs.existsSync(distPath)) {
        res.sendFile(path.join(distPath, "index.html"));
      } else {
        res.status(404).send("Not found");
      }
    });

    app.use((err, req, res, next) => {
      console.error("❌ Error global:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    });

    // ============================================================================
    // INICIAR SERVIDOR
    // ============================================================================
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Servidor backend en http://localhost:${PORT}`);
      setTimeout(() => {
        startLicenseMonitor().catch(console.error);
        startLogCleanup();
        startBackupScheduler().catch(console.error); // ← NUEVO
      }, 2000);
    });
  } catch (err) {
    console.error("❌ Error fatal:", err);
    process.exit(1);
  }
})();

export default app;
