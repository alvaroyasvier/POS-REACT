// frontend/src/hooks/useSessionTimeout.js
import { useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { useConfig } from "../context/ConfigContext";
import api from "../api";
import Swal from "sweetalert2";

export const useSessionTimeout = () => {
  const { user, logout } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const activityIntervalRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (!user) return;

    const autoLogout = config?.security?.autoLogout ?? true;

    if (!autoLogout) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
      return;
    }

    if (!activityIntervalRef.current) {
      activityIntervalRef.current = setInterval(() => {
        api.post("/auth/update-activity").catch(console.error);
      }, 30000);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    const timeoutMinutes = config?.security?.sessionTimeout || 30;
    const warningTime = (timeoutMinutes - 1) * 60 * 1000;
    const logoutTime = timeoutMinutes * 60 * 1000;

    if (timeoutMinutes > 1) {
      warningRef.current = setTimeout(() => {
        Swal.fire({
          title: "⚠️ Sesión por expirar",
          text: `Tu sesión se cerrará en 1 minuto por inactividad. ¿Deseas continuar?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Continuar",
          cancelButtonText: "Cerrar sesión",
          timer: 60000,
          timerProgressBar: true,
          allowOutsideClick: false,
        }).then((result) => {
          if (result.isConfirmed) {
            resetTimer();
            api.post("/auth/update-activity").catch(console.error);
          } else if (result.dismiss === Swal.DismissReason.timer) {
            handleLogout();
          } else {
            handleLogout();
          }
        });
      }, warningTime);
    }

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, logoutTime);
  }, [user, config, navigate]);

  const handleLogout = useCallback(() => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    logout();
    navigate("/login");

    Swal.fire({
      title: "🔒 Sesión cerrada",
      text: "Tu sesión ha sido cerrada por inactividad",
      icon: "info",
      timer: 3000,
      showConfirmButton: true,
    });
  }, [logout, navigate]);

  useEffect(() => {
    if (!user) {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
      return;
    }

    resetTimer();

    const events = [
      "mousedown",
      "keydown",
      "mousemove",
      "scroll",
      "click",
      "touchstart",
    ];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };
  }, [user, resetTimer]);

  return { resetTimer };
};
