import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);
      setTimeout(
        () => {
          dismiss(id);
        },
        variant === 'error' ? 6000 : 3400
      );
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-auto pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md text-xs font-medium animate-fade-up ${
              toast.variant === 'success'
                ? 'bg-white/95 dark:bg-[#17213A]/95 border-emerald-200 dark:border-[#34D399]/40 text-slate-900 dark:text-[#F8FAFC]'
                : toast.variant === 'error'
                ? 'bg-white/95 dark:bg-[#17213A]/95 border-rose-200 dark:border-[#FB7185]/45 text-slate-900 dark:text-[#F8FAFC]'
                : 'bg-white/95 dark:bg-[#17213A]/95 border-slate-200 dark:border-[#273554] text-slate-900 dark:text-[#F8FAFC]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.variant === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
              ) : toast.variant === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-[#FB7185] shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-[#4D8DFF] shrink-0" />
              )}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
    };
  }
  return ctx;
}
