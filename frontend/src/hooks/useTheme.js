// frontend/src/hooks/useTheme.js
import { useEffect } from "react";
import { useConfig } from "../context/ConfigContext";

const applyTheme = (theme) => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

export const useTheme = () => {
  const { config, loading } = useConfig();

  useEffect(() => {
    if (!loading && config) {
      const theme = config.appearance?.theme || "light";
      applyTheme(theme);
    }
  }, [config, loading]);

  useEffect(() => {
    const handleConfigUpdate = (event) => {
      const newConfig = event.detail;
      if (newConfig?.appearance?.theme) {
        applyTheme(newConfig.appearance.theme);
      }
    };

    window.addEventListener("configUpdated", handleConfigUpdate);
    return () =>
      window.removeEventListener("configUpdated", handleConfigUpdate);
  }, []);
};
