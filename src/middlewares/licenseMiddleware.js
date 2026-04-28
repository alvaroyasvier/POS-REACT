// backend/src/middlewares/licenseMiddleware.js
import { getCurrentLicenseStatus } from "../services/licenseMonitor.js";

const PUBLIC_PATHS = [
  "/api/license/status",
  "/api/license/activate",
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/2fa/setup",
  "/api/auth/2fa/verify",
  "/api/auth/2fa/disable",
  "/api/auth/2fa/status",
  "/api/auth/verify-password",
  "/api/auth/update-activity",
  "/api/health",
  "/api/test",
];

export const requireLicense = (req, res, next) => {
  // Rutas públicas sin licencia
  if (PUBLIC_PATHS.some((path) => req.path.startsWith(path))) {
    return next();
  }

  const status = getCurrentLicenseStatus();

  if (!status.valid) {
    return res.status(403).json({
      success: false,
      message: "Licencia requerida o inválida",
      licenseRequired: true,
    });
  }

  req.license = status.data;
  next();
};
