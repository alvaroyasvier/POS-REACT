import { createContext, useContext, useState, useEffect, useRef } from "react";
import api from "../api";
import { useAuth } from "../store/authStore";
import LoaderPOS from "../components/LoaderPOS";

const ConfigContext = createContext();

const DEFAULT_CONFIG = {
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
    companyName: "CAFÉ UNIVERSAL",
    companyAddress: "Avda. Central, 4",
    companyPhone: "📞 555-123-456",
    companyEmail: "info@cafeuniversal.com",
    companyRuc: "C-91233456",
    footerMessage: "Muchas gracias por su visita",
    promoMessage:
      "Le recordamos que cada mañana ofrecemos desayuno té o café con croissant por 1,40 € o café, té con croissant y zumo por 1,60 €.",
    website: "www.cafeuniversal.com",
    logo: "",
    paperSize: "80mm",
    copies: 1,
    taxRate: 10,
    showTaxInfo: true,
  },
  security: {
    sessionTimeout: 30,
    autoLogout: true,
    requirePasswordForRefund: true,
    maxLoginAttempts: 3,
    twoFactorAuth: false,
  },
  system: {
    currency: "EUR",
    currencySymbol: "€",
    language: "es",
    dateFormat: "DD/MM/YYYY",
    timezone: "Europe/Madrid",
    decimalPlaces: 2,
    thousandsSeparator: ".",
  },
  printer: {
    printerType: "thermal",
    printerPort: "USB",
    printerModel: "Epson TM-T20",
    paperWidth: 80,
    autoCut: true,
  },
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const loadedRef = useRef(false);

  const loadConfig = async () => {
    if (!user) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/configuracion");
      if (response.data.success && response.data.data) {
        const configData = response.data.data;
        setConfig({
          notifications: {
            ...DEFAULT_CONFIG.notifications,
            ...(configData.notifications || {}),
          },
          appearance: {
            ...DEFAULT_CONFIG.appearance,
            ...(configData.appearance || {}),
          },
          invoice: { ...DEFAULT_CONFIG.invoice, ...(configData.invoice || {}) },
          security: {
            ...DEFAULT_CONFIG.security,
            ...(configData.security || {}),
          },
          system: { ...DEFAULT_CONFIG.system, ...(configData.system || {}) },
          printer: { ...DEFAULT_CONFIG.printer, ...(configData.printer || {}) },
        });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error("❌ Error cargando configuración:", error);
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadedRef.current && user) {
      loadedRef.current = true;
      loadConfig();
    } else if (!user) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "configuracion_actualizada") {
        loadConfig();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const handleConfigUpdate = (e) => {
      if (e.detail) {
        setConfig(e.detail);
      } else {
        loadConfig();
      }
    };
    window.addEventListener("configUpdated", handleConfigUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("configUpdated", handleConfigUpdate);
    };
  }, []);

  const updateConfig = (newConfig) => {
    setConfig(newConfig);
    window.dispatchEvent(
      new CustomEvent("configUpdated", { detail: newConfig }),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-gray-50 dark:bg-gray-900">
        <LoaderPOS message="Cargando configuración..." />
      </div>
    );
  }

  return (
    <ConfigContext.Provider
      value={{ config, loading, reload: loadConfig, updateConfig }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig debe usarse dentro de ConfigProvider");
  }
  return context;
};
