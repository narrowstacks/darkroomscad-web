"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

type Toast = { id: number; message: string };
const ToastContext = createContext<(message: string) => void>(() => {});

// Minimal toast: a single transient confirmation slid up from the bottom. Enough
// to acknowledge actions (preset saved/deleted) without a full notification stack.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message });
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {typeof document !== "undefined" && toast && createPortal(
        <div className="animate-slide-fade-bottom pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
          <div className="menu-surface flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
            style={{ color: "var(--text)" }} role="status">
            <Check className="size-4" style={{ color: "var(--primary)" }} />
            {toast.message}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
