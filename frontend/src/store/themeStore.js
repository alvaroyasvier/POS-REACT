import { create } from 'zustand';

export const useTheme = create((set, get) => ({
  theme: 'dark',
  init: () => {
    const saved = localStorage.getItem('pos-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    set({ theme: saved });
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pos-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  }
}));