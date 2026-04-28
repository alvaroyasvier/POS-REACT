import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { useAuth } from "../store/authStore";
import { useTranslation } from "../context/LanguageContext";
import Swal from "sweetalert2";
import {
  Store,
  Mail,
  Lock,
  ArrowRight,
  Shield,
  Key,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState(null);
  const [countdownInterval, setCountdownInterval] = useState(null);

  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [tempToken, setTempToken] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuth((s) => s.login);
  const { t } = useTranslation();

  useEffect(() => {
    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [countdownInterval]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("session_closed") === "true") {
      sessionStorage.removeItem("session_conflict_redirected");
      sessionStorage.removeItem("last_session_redirect");
      Swal.fire({
        icon: "warning",
        title: t("login.session_closed_title"),
        text: t("login.session_closed_text"),
        confirmButtonText: t("login.understood"),
        confirmButtonColor: "#3085d6",
        allowOutsideClick: false,
      }).then(() => {
        window.history.replaceState({}, document.title, "/login");
      });
    }
  }, [location]);

  useEffect(() => {
    if (lockRemainingSeconds !== null && lockRemainingSeconds > 0) {
      const interval = setInterval(() => {
        setLockRemainingSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            setLockRemainingSeconds(null);
            setErr("");
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      setCountdownInterval(interval);
      return () => clearInterval(interval);
    } else if (lockRemainingSeconds === 0) {
      setLockRemainingSeconds(null);
      setErr("");
    }
  }, [lockRemainingSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setRemainingAttempts(null);
    setLockRemainingSeconds(null);
    setLoading(true);

    try {
      const payload = { email, password };
      if (requires2FA && twoFactorToken)
        payload.twoFactorToken = twoFactorToken;

      const res = await api.post("/auth/login", payload);

      if (res.data.requires2FA) {
        setRequires2FA(true);
        setPendingEmail(res.data.data.email);
        setTempToken(res.data.data.tempToken);
        setTwoFactorToken("");
        setLoading(false);
        return;
      }

      if (res.data.success) {
        // ✅ Ya no guardamos token, solo usuario
        localStorage.setItem("pos_user", JSON.stringify(res.data.data.user));
        login(res.data.data.user);

        const userRole = res.data.data.user.role;
        if (userRole === "admin") navigate("/reportes");
        else if (userRole === "warehouse") navigate("/stock");
        else navigate("/caja");
      }
    } catch (e) {
      console.error("❌ Error en login:", e);
      const errorData = e.response?.data || {};
      const errorMsg = errorData.message || t("login.error_credentials");

      if (errorData.remainingAttempts !== undefined) {
        setRemainingAttempts(errorData.remainingAttempts);
      }
      if (errorData.lockRemainingSeconds) {
        setLockRemainingSeconds(errorData.lockRemainingSeconds);
      } else if (errorData.lockRemainingMinutes) {
        setLockRemainingSeconds(errorData.lockRemainingMinutes * 60);
      }

      setErr(errorMsg);
      setTwoFactorToken("");

      if (
        e.response?.status === 409 &&
        e.response?.data?.code === "SESSION_ACTIVE"
      ) {
        Swal.fire({
          icon: "error",
          title: t("login.session_closed_title"),
          text: errorMsg,
          confirmButtonText: t("login.understood"),
          confirmButtonColor: "#dc2626",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!twoFactorToken || twoFactorToken.length !== 6) {
      return setErr(t("login.2fa_code_label"));
    }
    setLoading(true);
    setErr("");
    try {
      const res = await api.post("/auth/login", {
        email: pendingEmail || email,
        password,
        twoFactorToken,
      });
      if (res.data.success) {
        localStorage.setItem("pos_user", JSON.stringify(res.data.data.user));
        login(res.data.data.user);
        const userRole = res.data.data.user.role;
        if (userRole === "admin") navigate("/reportes");
        else if (userRole === "warehouse") navigate("/stock");
        else navigate("/caja");
      }
    } catch (e) {
      setErr(e.response?.data?.message || t("login.error_credentials"));
      setTwoFactorToken("");
    } finally {
      setLoading(false);
    }
  };

  const cancel2FA = () => {
    setRequires2FA(false);
    setTwoFactorToken("");
    setPendingEmail("");
    setTempToken(null);
    setPassword("");
    setErr("");
  };

  const handle2FAInput = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setTwoFactorToken(value);
  };

  const handle2FAKeyPress = (e) => {
    if (e.key === "Enter" && twoFactorToken.length === 6 && !loading) {
      verify2FA();
    }
  };

  const formatLockTime = (seconds) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins} minuto(s) y ${secs} segundo(s)`;
    return `${secs} segundo(s)`;
  };

  const TwoFAModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <Shield className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {t("login.2fa_title")}
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {t("login.2fa_subtitle")}
            </p>
          </div>
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                {t("login.2fa_description")}
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {pendingEmail || email}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("login.2fa_code_label")}
              </label>
              <div className="relative">
                <Key
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorToken}
                  onChange={handle2FAInput}
                  onKeyPress={handle2FAKeyPress}
                  disabled={loading}
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t("login.2fa_code_help")}
              </p>
            </div>
            {err && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
                {err}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancel2FA}
                disabled={loading}
                className="flex-1 py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {t("login.2fa_cancel")}
              </button>
              <button
                type="button"
                onClick={verify2FA}
                disabled={loading || twoFactorToken.length !== 6}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <span>{t("login.2fa_verifying")}</span>
                ) : (
                  <>
                    {t("login.2fa_verify")}{" "}
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("app.footer")}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t("app.copyright")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (requires2FA) return <TwoFAModal />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <Store className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">{t("app.name")}</h1>
            <p className="text-blue-100 text-sm mt-1">{t("app.tagline")}</p>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("login.email")}
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="email"
                  placeholder="admin@pos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("login.password")}
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {remainingAttempts !== null && remainingAttempts > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-200 text-sm">
                <AlertTriangle size={18} />
                <span>
                  Contraseña incorrecta. Te quedan{" "}
                  <strong>{remainingAttempts}</strong> intento(s) antes de que
                  la cuenta se bloquee.
                </span>
              </div>
            )}

            {lockRemainingSeconds !== null && lockRemainingSeconds > 0 && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                <Clock size={18} />
                <span>
                  Cuenta bloqueada. Intenta de nuevo en{" "}
                  <strong>{formatLockTime(lockRemainingSeconds)}</strong>.
                </span>
              </div>
            )}

            {err && !remainingAttempts && !lockRemainingSeconds && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                (lockRemainingSeconds !== null && lockRemainingSeconds > 0)
              }
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <span>{t("login.logging_in")}</span>
              ) : (
                <>
                  {t("login.login_button")}{" "}
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("app.footer")}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {t("app.copyright")}
            </p>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          {t("login.demo_credentials")}:{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            admin@pos.com
          </code>{" "}
          /{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            123456
          </code>
        </p>
      </div>
    </div>
  );
}
