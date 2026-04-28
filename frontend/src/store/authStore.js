import { create } from "zustand";
import api from "../api";

export const useAuth = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("pos_user")) || null,

  login: (userData) => {
    localStorage.setItem("pos_user", JSON.stringify(userData));
    set({ user: userData });
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
    localStorage.removeItem("pos_user");
    set({ user: null });
    window.location.href = "/login";
  },
}));
