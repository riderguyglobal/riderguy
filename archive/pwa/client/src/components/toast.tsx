'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  info:    Info,
};

const COLORS = {
  success: 'text-brand-500',
  error:   'text-red-500',
  info:    'text-blue-500',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = ICONS[toast.type];

  useEffect(() => {
    const t = setTimeout(onDismiss, 2800);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl shadow-active
                 animate-slide-from-top max-w-[calc(100vw-32px)] mx-auto pointer-events-auto"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${COLORS[toast.type]}`} />
      <span className="text-[14px] font-semibold text-surface-900 flex-1 leading-snug">
        {toast.message}
      </span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-surface-400
                   hover:text-surface-600 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`;
    setToasts(prev => [...prev.slice(-2), { id, message, type }]);
  }, []);

  const ctx: ToastContextValue = {
    toast:   addToast,
    success: msg => addToast(msg, 'success'),
    error:   msg => addToast(msg, 'error'),
    info:    msg => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col gap-2 pt-[calc(env(safe-area-inset-top,0px)+12px)] px-4 pointer-events-none">
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
