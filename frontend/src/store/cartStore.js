// frontend/src/store/cartStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useCart = create(
  persist(
    (set, get) => ({
      items: [],

      addToCart: (product) => {
        const { items } = get();
        const existingItem = items.find((item) => item.id === product.id);

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                id: product.id,
                name: product.name,
                price: Number(product.price) || 0,
                qty: 1,
              },
            ],
          });
        }
      },

      updateQty: (id, qty) => {
        const { items } = get();
        if (qty <= 0) {
          set({ items: items.filter((item) => item.id !== id) });
        } else {
          set({
            items: items.map((item) =>
              item.id === id ? { ...item, qty: qty } : item,
            ),
          });
        }
      },

      clear: () => set({ items: [] }),

      // ✅ CORREGIR: Asegurar que total siempre sea un número
      total: () => {
        const { items } = get();
        const totalValue = items.reduce((sum, item) => {
          const price = Number(item.price) || 0;
          const qty = Number(item.qty) || 0;
          return sum + price * qty;
        }, 0);
        // Devolver como número con 2 decimales
        return Number(totalValue.toFixed(2));
      },

      // ✅ Agregar función para obtener items
      getItems: () => get().items,
    }),
    {
      name: "cart-storage",
    },
  ),
);
