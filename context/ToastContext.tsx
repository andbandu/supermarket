'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number; // ms, default 4000
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
  toast: {
    success: (message: string, title?: string, duration?: number) => string;
    error: (message: string, title?: string, duration?: number) => string;
    warning: (message: string, title?: string, duration?: number) => string;
    info: (message: string, title?: string, duration?: number) => string;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Global listener pattern allowing direct toast.* calls anywhere in the project
type ToastListener = (type: ToastType, message: string, title?: string, duration?: number) => string;
let globalToastListener: ToastListener | null = null;

export const toast = {
  success: (message: string, title?: string, duration?: number) =>
    globalToastListener ? globalToastListener('success', message, title, duration) : '',
  error: (message: string, title?: string, duration?: number) =>
    globalToastListener ? globalToastListener('error', message, title, duration) : '',
  warning: (message: string, title?: string, duration?: number) =>
    globalToastListener ? globalToastListener('warning', message, title, duration) : '',
  info: (message: string, title?: string, duration?: number) =>
    globalToastListener ? globalToastListener('info', message, title, duration) : '',
};

// Single Toast Card Component with progress bar and hover pause
function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const duration = item.duration ?? 4000;
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(duration);

  useEffect(() => {
    if (duration <= 0) return; // persistent toast if duration <= 0

    const updateInterval = 25;
    const interval = setInterval(() => {
      if (isPaused) {
        startTimeRef.current = Date.now() - (duration - remainingRef.current);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const left = Math.max(0, duration - elapsed);
      remainingRef.current = left;
      setProgress((left / duration) * 100);

      if (left <= 0) {
        clearInterval(interval);
        onDismiss(item.id);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [duration, isPaused, item.id, onDismiss]);

  const config = {
    success: {
      border: 'border-emerald-500/40',
      bg: 'bg-slate-900/95',
      glow: 'shadow-emerald-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      progressBar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      Icon: CheckCircle2,
      defaultTitle: 'Success',
    },
    error: {
      border: 'border-rose-500/50',
      bg: 'bg-slate-900/95',
      glow: 'shadow-rose-500/10',
      iconBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      progressBar: 'bg-gradient-to-r from-rose-500 to-red-400',
      Icon: AlertOctagon,
      defaultTitle: 'Error',
    },
    warning: {
      border: 'border-amber-500/50',
      bg: 'bg-slate-900/95',
      glow: 'shadow-amber-500/10',
      iconBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      progressBar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
      Icon: AlertTriangle,
      defaultTitle: 'Warning',
    },
    info: {
      border: 'border-sky-500/40',
      bg: 'bg-slate-900/95',
      glow: 'shadow-sky-500/10',
      iconBg: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      progressBar: 'bg-gradient-to-r from-sky-500 to-blue-400',
      Icon: Info,
      defaultTitle: 'Notice',
    },
  }[item.type];

  const IconComponent = config.Icon;
  const title = item.title || config.defaultTitle;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative overflow-hidden w-full max-w-sm sm:max-w-md ${config.bg} ${config.border} border rounded-xl shadow-2xl ${config.glow} backdrop-blur-md transition-all duration-200 transform hover:scale-[1.01]`}
      style={{
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div className="p-3.5 flex items-start gap-3">
        {/* Type Icon Badge */}
        <div className={`p-2 rounded-lg shrink-0 ${config.iconBg}`}>
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs font-bold text-white tracking-wide uppercase">
            {title}
          </h4>
          <p className="mt-0.5 text-xs text-slate-300 leading-relaxed break-words whitespace-pre-line font-medium">
            {item.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => onDismiss(item.id)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition shrink-0"
          title="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Countdown Progress Bar */}
      {duration > 0 && (
        <div className="h-0.5 w-full bg-slate-800">
          <div
            className={`h-full ${config.progressBar} transition-all duration-75`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4200): string => {
      const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const newToast: ToastItem = {
        id,
        type,
        title,
        message,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        // Limit max concurrent visible toasts to 5 for clean UI
        const truncated = prev.length >= 5 ? prev.slice(prev.length - 4) : prev;
        return [...truncated, newToast];
      });

      return id;
    },
    []
  );

  // Link global singleton to this provider instance
  useEffect(() => {
    globalToastListener = showToast;
    return () => {
      globalToastListener = null;
    };
  }, [showToast]);

  const toastMethods = {
    success: (message: string, title?: string, duration?: number) =>
      showToast('success', message, title, duration),
    error: (message: string, title?: string, duration?: number) =>
      showToast('error', message, title, duration),
    warning: (message: string, title?: string, duration?: number) =>
      showToast('warning', message, title, duration),
    info: (message: string, title?: string, duration?: number) =>
      showToast('info', message, title, duration),
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        clearAllToasts,
        toast: toastMethods,
      }}
    >
      {children}

      {/* Floating Toast Notification Container (Top-Right) */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-[92vw] sm:max-w-md pointer-events-none no-print select-none"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if invoked outside ToastProvider
    return {
      toasts: [],
      showToast: (type: ToastType, message: string, title?: string, duration?: number) =>
        toast[type](message, title, duration),
      dismissToast: () => {},
      clearAllToasts: () => {},
      toast,
    };
  }
  return ctx;
}

