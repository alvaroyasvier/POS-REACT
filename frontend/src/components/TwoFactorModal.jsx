// frontend/src/components/TwoFactorModal.jsx
import { useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  Shield,
  Key,
  RefreshCw,
  Copy,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";

export default function TwoFactorModal({ isOpen, onClose, onActivated, user }) {
  const [step, setStep] = useState(1); // 1: QR, 2: Verificar, 3: Backup codes
  const [qrCode, setQrCode] = useState(null);
  const [manualKey, setManualKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(-1);

  // ✅ Cargar configuración 2FA
  const loadSetup = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/2fa/setup");
      if (res.data.success) {
        setQrCode(res.data.data.qrCode);
        setManualKey(res.data.data.manualEntryKey);
        setStep(2);
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo cargar configuración 2FA",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Activar 2FA
  const activate2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      return Swal.fire("Error", "Ingresa un código de 6 dígitos", "warning");
    }
    try {
      setLoading(true);
      const res = await api.post("/auth/2fa/activate", {
        token: verificationCode,
      });
      if (res.data.success) {
        setBackupCodes(res.data.data.backupCodes);
        setStep(3);
        onActivated?.(); // Notificar al padre
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo activar 2FA",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Desactivar 2FA
  const deactivate2FA = async () => {
    if (!password)
      return Swal.fire("Error", "Ingresa tu contraseña", "warning");
    try {
      setLoading(true);
      const res = await api.post("/auth/2fa/deactivate", {
        password,
        token: verificationCode,
      });
      if (res.data.success) {
        Swal.fire("🔓 Desactivado", "2FA ha sido desactivado", "success");
        onActivated?.();
        onClose();
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo desactivar",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Regenerar códigos de respaldo
  const regenerateBackupCodes = async () => {
    if (!password)
      return Swal.fire("Error", "Ingresa tu contraseña", "warning");
    try {
      setLoading(true);
      const res = await api.post("/auth/2fa/backup-codes", { password });
      if (res.data.success) {
        setBackupCodes(res.data.data.backupCodes);
        Swal.fire("✅ Actualizado", "Nuevos códigos generados", "success");
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al regenerar",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(-1), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="text-blue-600" size={20} />
            Autenticación de Dos Factores
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Paso 1: Iniciar configuración */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <AlertTriangle
                  className="mx-auto text-blue-600 mb-2"
                  size={32}
                />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  El 2FA añade una capa extra de seguridad. Necesitarás una app
                  como Google Authenticator.
                </p>
              </div>
              <button
                onClick={loadSetup}
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="animate-spin" size={18} />
                ) : (
                  <Key size={18} />
                )}
                Comenzar configuración
              </button>
            </div>
          )}

          {/* Paso 2: Mostrar QR y verificar */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                {qrCode && (
                  <img
                    src={qrCode}
                    alt="QR para 2FA"
                    className="w-48 h-48 border rounded-lg"
                  />
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Escanea con Google Authenticator
                </p>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  O ingresa manualmente:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded border text-sm font-mono break-all">
                    {manualKey}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(manualKey);
                      Swal.fire("Copiado", "", "success");
                    }}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Código de verificación (6 dígitos)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.replace(/\D/g, ""))
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest dark:bg-gray-800 dark:border-gray-600"
                  placeholder="000000"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Atrás
                </button>
                <button
                  onClick={activate2FA}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {loading ? "Verificando..." : "Activar 2FA"}
                </button>
              </div>
            </div>
          )}

          {/* Paso 3: Códigos de respaldo */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                <CheckCircle
                  className="mx-auto text-green-600 mb-2"
                  size={32}
                />
                <p className="font-semibold text-green-800 dark:text-green-200">
                  ✅ 2FA Activado
                </p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  Guarda estos códigos en un lugar seguro
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded border"
                  >
                    <code className="font-mono text-sm">{code}</code>
                    <button
                      onClick={() => copyCode(code, idx)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                    >
                      {copiedIndex === idx ? (
                        <Check size={14} className="text-green-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Entendido, cerrar
              </button>
            </div>
          )}

          {/* Panel para desactivar/regenerar (si ya está activado) */}
          {user?.twoFactorEnabled && step === 1 && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
              <h3 className="font-medium">Gestión de 2FA</h3>

              <div>
                <label className="text-sm font-medium">
                  Contraseña para confirmar
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full px-3 py-2 border rounded-lg mt-1 dark:bg-gray-800 dark:border-gray-600"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={regenerateBackupCodes}
                  disabled={loading || !password}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  <RefreshCw size={14} className="inline mr-1" /> Regenerar
                  códigos
                </button>
                <button
                  onClick={deactivate2FA}
                  disabled={loading || !password}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Desactivar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
