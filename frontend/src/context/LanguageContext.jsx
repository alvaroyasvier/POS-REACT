import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useConfig } from "./ConfigContext";
import es from "../locales/es.json";
import en from "../locales/en.json";
import pt from "../locales/pt.json";

const translations = { es, en, pt };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { config } = useConfig();
  const language = config?.system?.language || "es";
  const [messages, setMessages] = useState(translations[language] || translations.es);

  useEffect(() => {
    if (translations[language]) {
      setMessages(translations[language]);
    }
  }, [language]);

  // Función de traducción con soporte para parámetros simples
  const t = useCallback((key, params = {}) => {
    const keys = key.split('.');
    let value = keys.reduce((obj, k) => obj?.[k], messages);
    if (value === undefined) return key; // fallback a la clave
    // Reemplazo de parámetros {name}
    if (typeof value === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, v);
      });
    }
    return value;
  }, [messages]);

  return (
    <LanguageContext.Provider value={{ t, language }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation debe usarse dentro de LanguageProvider");
  }
  return context;
};