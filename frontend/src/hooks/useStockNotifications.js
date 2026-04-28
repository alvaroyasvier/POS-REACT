// frontend/src/hooks/useStockNotifications.js
import { useState, useEffect, useCallback, useRef } from "react";
import { useConfig } from "../context/ConfigContext";
import api from "../api";

// ✅ Función para reproducir sonido de notificación
const playNotificationSound = () => {
  try {
    // Crear un sonido simple usando Web Audio API
    const audioContext = new (
      window.AudioContext || window.webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = 880; // Frecuencia en Hz

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (err) {
    console.warn("⚠️ No se pudo reproducir sonido:", err);
  }
};

export const useStockNotifications = (user) => {
  const { config, loading: configLoading } = useConfig();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);
  const previousNotificationsRef = useRef([]);

  const loadNotifications = useCallback(async () => {
    if (!user || configLoading || !config) return;

    try {
      setLoading(true);
      const response = await api.get("/products");
      const products = response.data?.data || response.data || [];

      const threshold = config.notifications?.lowStockThreshold || 10;
      const lowStockEnabled = config.notifications?.lowStockEnabled !== false;
      const outOfStockEnabled =
        config.notifications?.outOfStockEnabled !== false;
      const soundEnabled = config.notifications?.soundEnabled || false;

      const newNotifications = [];
      const notificationIds = new Set();

      if (lowStockEnabled) {
        const lowStock = products.filter(
          (p) => p.stock <= threshold && p.stock > 0,
        );
        lowStock.forEach((product) => {
          const id = `low-${product.id}`;
          notificationIds.add(id);
          newNotifications.push({
            id,
            type: "warning",
            title: "⚠️ Stock Bajo",
            message: `${product.name}: ${product.stock} unidades`,
            productId: product.id,
            stock: product.stock,
            timestamp: Date.now(),
            read: false,
          });
        });
      }

      if (outOfStockEnabled) {
        const outOfStock = products.filter((p) => p.stock === 0);
        outOfStock.forEach((product) => {
          const id = `out-${product.id}`;
          notificationIds.add(id);
          newNotifications.push({
            id,
            type: "danger",
            title: "❌ Producto Agotado",
            message: `${product.name} - Sin stock`,
            productId: product.id,
            stock: 0,
            timestamp: Date.now(),
            read: false,
          });
        });
      }

      // Mantener estado "read" de notificaciones existentes
      setNotifications((prev) => {
        const updatedNotifications = newNotifications.map((newNotif) => {
          const existingNotif = prev.find((p) => p.id === newNotif.id);
          return existingNotif
            ? { ...newNotif, read: existingNotif.read }
            : newNotif;
        });

        // ✅ Reproducir sonido si hay NUEVAS notificaciones
        if (soundEnabled && updatedNotifications.length > 0) {
          const prevIds = new Set(
            previousNotificationsRef.current.map((n) => n.id),
          );
          const hasNewNotifications = updatedNotifications.some(
            (n) => !prevIds.has(n.id) && !n.read,
          );

          if (hasNewNotifications) {
            playNotificationSound();
          }
        }

        previousNotificationsRef.current = updatedNotifications;
        setUnreadCount(updatedNotifications.filter((n) => !n.read).length);
        return updatedNotifications;
      });
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    } finally {
      setLoading(false);
    }
  }, [user, config, configLoading]);

  // ✅ Configurar intervalo de auto-refresh
  useEffect(() => {
    if (!user || !config) return;

    // Limpiar intervalo anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Cargar inmediatamente
    loadNotifications();

    // Configurar nuevo intervalo según configuración
    const refreshSeconds = config.notifications?.autoRefresh || 30;
    console.log(`🔄 Auto-refresh configurado: ${refreshSeconds} segundos`);

    intervalRef.current = setInterval(() => {
      loadNotifications();
    }, refreshSeconds * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, config, loadNotifications]);

  // ✅ Escuchar actualizaciones de configuración
  useEffect(() => {
    const handleConfigUpdate = (e) => {
      console.log("📢 Configuración actualizada, recargando notificaciones...");
      loadNotifications();
    };

    window.addEventListener("configUpdated", handleConfigUpdate);
    return () =>
      window.removeEventListener("configUpdated", handleConfigUpdate);
  }, [loadNotifications]);

  const markAsRead = (id) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      setUnreadCount(updated.filter((n) => !n.read).length);
      previousNotificationsRef.current = updated;
      return updated;
    });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      setUnreadCount(0);
      previousNotificationsRef.current = updated;
      return updated;
    });
  };

  const reload = () => {
    loadNotifications();
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    reload,
  };
};
