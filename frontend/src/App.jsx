// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/authStore";
import Layout from "./components/Layout";
import { ConfigProvider } from "./context/ConfigContext";
import { LanguageProvider } from "./context/LanguageContext";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { useState, useEffect, useRef } from "react";
import api from "./api";
import LoaderPOS from "./components/LoaderPOS";

// Páginas
import Activacion from "./pages/Activacion";
import Login from "./pages/Login";
import Caja from "./pages/Caja";
import Reportes from "./pages/Reportes";
import Productos from "./pages/Productos";
import Categorias from "./pages/Categorias";
import Usuarios from "./pages/Usuarios";
import Logs from "./pages/Logs";
import Stock from "./pages/Stock";
import Historial from "./pages/Historial";
import HistorialStock from "./pages/HistorialStock";
import Configuracion from "./pages/Configuracion";
import CashManagement from "./pages/CashManagement";

const LicenseGuard = ({ children }) => {
  const [status, setStatus] = useState({ loading: true, valid: false });
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    (async () => {
      try {
        const res = await api.get("/license/status");
        setStatus({ loading: false, valid: res.data.data?.valid });
      } catch {
        setStatus({ loading: false, valid: false });
      }
    })();
  }, []);

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoaderPOS message="Verificando licencia..." />
      </div>
    );
  }

  if (!status.valid) {
    return <Navigate to="/activacion" replace />;
  }

  return children;
};

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    const defaultPath =
      user.role === "admin"
        ? "/reportes"
        : user.role === "warehouse"
          ? "/stock"
          : "/caja";
    return <Navigate to={defaultPath} replace />;
  }
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  useSessionTimeout();

  return (
    <Routes>
      <Route path="/activacion" element={<Activacion />} />
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/caja" replace />}
      />

      <Route path="/" element={<Layout />}>
        {/* Rutas protegidas */}
        <Route
          path="caja"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["cashier", "admin"]}>
                <Caja />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="stock"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["warehouse", "admin"]}>
                <Stock />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="historial"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["cashier", "admin"]}>
                <Historial />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="historial-stock"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["warehouse", "admin"]}>
                <HistorialStock />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="reportes"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Reportes />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="productos"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Productos />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="categorias"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Categorias />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="usuarios"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Usuarios />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="logs"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Logs />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="configuracion"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Configuracion />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="caja-gestion"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin", "cashier"]}>
                <CashManagement />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          index
          element={
            <Navigate
              to={
                user?.role === "admin"
                  ? "/reportes"
                  : user?.role === "warehouse"
                    ? "/stock"
                    : "/caja"
              }
              replace
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/activacion" replace />} />
    </Routes>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function App() {
  return (
    <ConfigProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ConfigProvider>
  );
}

export default App;
