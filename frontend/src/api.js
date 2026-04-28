import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: true, // ✅ Envía cookies automáticamente
  headers: { "Content-Type": "application/json" },
});

let isRedirecting = false;
let redirectTimer = null;

const resetRedirect = () => {
  if (redirectTimer) clearTimeout(redirectTimer);
  redirectTimer = setTimeout(() => {
    isRedirecting = false;
    sessionStorage.removeItem("session_conflict_redirected");
    sessionStorage.removeItem("last_session_redirect");
  }, 2000);
};

// ✅ Eliminamos el interceptor que añadía token manualmente
api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const url = error.config?.url;

    if (isRedirecting) return Promise.reject(error);
    if (url?.includes("/auth/logout")) return Promise.reject(error);

    if (status === 401 && data?.code === "SESSION_CONFLICT") {
      const lastRedirect = sessionStorage.getItem("last_session_redirect");
      const now = Date.now();
      if (lastRedirect && now - parseInt(lastRedirect) < 5000)
        return Promise.reject(error);
      sessionStorage.setItem("last_session_redirect", now.toString());
      isRedirecting = true;
      localStorage.removeItem("pos_user");
      if (!window.location.pathname.includes("/login")) {
        window.location.replace("/login?session_closed=true");
      } else {
        resetRedirect();
      }
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      !url?.includes("/auth/me") &&
      !url?.includes("/auth/login")
    ) {
      localStorage.removeItem("pos_user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

window.addEventListener("load", resetRedirect);
export default api;
