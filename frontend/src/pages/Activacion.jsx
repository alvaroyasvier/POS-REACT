// frontend/src/pages/Activacion.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Swal from "sweetalert2";
import { useTranslation } from "../context/LanguageContext";
import { escapeHtml } from "../utils/sanitize"; // ✅ Seguridad XSS
import {
  Key,
  Shield,
  Loader2,
  Store,
  CheckCircle,
  XCircle,
  Calendar,
} from "lucide-react";

export default function Activacion() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [licenseToken, setLicenseToken] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState(null);

  useEffect(() => {
    checkLicenseStatus();
  }, []);

  const checkLicenseStatus = async () => {
    try {
      const res = await api.get("/license/status");
      setLicenseStatus(res.data.data);
      if (res.data.data.valid) {
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch (err) {
      console.error("Error verificando licencia:", err);
    } finally {
      setChecking(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    const cleanedToken = licenseToken.replace(/[\s\n\r\t\u00A0]/g, "").trim();
    if (!cleanedToken) {
      return Swal.fire("Error", "Ingresa el token de licencia", "warning");
    }
    setLoading(true);
    try {
      const res = await api.post("/license/activate", {
        licenseToken: cleanedToken,
        customerName: customerName.trim() || null,
      });
      if (res.data.success) {
        await Swal.fire({
          title: t("activacion.valid_title"),
          // ✅ HTML escapado para prevenir XSS
          html: `
            <div style="text-align: left;">
              <p><strong>${t("configuracion.license.customer")}:</strong> ${escapeHtml(res.data.data.customerName)}</p>
              <p><strong>Plan:</strong> ${escapeHtml(res.data.data.plan?.toUpperCase())}</p>
              <p><strong>${t("configuracion.license.start_date")}:</strong> ${escapeHtml(res.data.data.startDate)}</p>
              <p><strong>${t("configuracion.license.end_date")}:</strong> ${escapeHtml(res.data.data.endDate)}</p>
              <p><strong>${t("configuracion.license.days_left")}:</strong> ${escapeHtml(String(res.data.data.daysLeft))}</p>
            </div>
          `,
          icon: "success",
        });
        navigate("/login");
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Token inválido",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (licenseStatus?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle
              className="text-green-600 dark:text-green-400"
              size={32}
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t("activacion.valid_title")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {licenseStatus.data?.customerName}
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Calendar size={16} />
              <span>
                {t("activacion.expires")}: {licenseStatus.data?.endDate}
              </span>
            </div>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-2">
              {licenseStatus.data?.daysLeft} {t("activacion.days_left")}
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {t("activacion.redirecting")}
          </p>
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4">
            <Store className="text-blue-600 dark:text-blue-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("activacion.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t("activacion.subtitle")}
          </p>
        </div>

        {licenseStatus &&
          !licenseStatus.valid &&
          licenseStatus.reason !== "no_license" && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <XCircle size={16} />
                {licenseStatus.message || "Licencia inválida"}
              </p>
            </div>
          )}

        <form onSubmit={handleActivate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("activacion.customer_name")}
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t("activacion.customer_placeholder")}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("activacion.token_label")}
            </label>
            <div className="relative">
              <Key
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={20}
              />
              <textarea
                value={licenseToken}
                onChange={(e) => setLicenseToken(e.target.value)}
                placeholder={t("activacion.token_placeholder")}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-xs resize-none"
                rows={4}
                autoFocus
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t("activacion.token_help")}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !licenseToken.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />{" "}
                {t("activacion.activating")}
              </>
            ) : (
              <>
                <Shield size={18} /> {t("activacion.activate_button")}
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            {t("activacion.no_license")}
          </p>
        </div>
      </div>
    </div>
  );
}
