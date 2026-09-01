import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

export type Tema = 'papel' | 'tinta';

const TEMA_KEY = 'cnv3_tema';

function temaInicial(): Tema {
  try {
    const t = localStorage.getItem(TEMA_KEY);
    return t === 'tinta' ? 'tinta' : 'papel';
  } catch {
    return 'papel';
  }
}

interface UIState {
  tema: Tema;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  horasSinReporte: number;
  toasts: Toast[];
  setTema: (t: Tema) => void;
  setSoundEnabled: (v: boolean) => void;
  setNotificationsEnabled: (v: boolean) => void;
  setHorasSinReporte: (v: number) => void;
  pushToast: (msg: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  tema: temaInicial(),
  soundEnabled: true,
  notificationsEnabled: false,
  horasSinReporte: 4,
  toasts: [],
  setTema: (t) => {
    try {
      localStorage.setItem(TEMA_KEY, t);
    } catch {
      // almacenamiento no disponible
    }
    set({ tema: t });
  },
  setSoundEnabled: (v) => set({ soundEnabled: v }),
  setNotificationsEnabled: (v) => set({ notificationsEnabled: v }),
  setHorasSinReporte: (v) => set({ horasSinReporte: v }),
  pushToast: (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => get().removeToast(id), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
