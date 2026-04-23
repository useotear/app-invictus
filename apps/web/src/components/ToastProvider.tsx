"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";

type Tone = "info" | "success" | "error";

interface ToastOptions {
  message: string;
  tone?: Tone;
  duration?: number;
  action?: { label: string; onClick: () => void | Promise<void> };
}

interface Toast extends Required<Omit<ToastOptions, "action">> {
  id: number;
  action?: ToastOptions["action"];
}

interface ToastApi {
  show: (opts: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast precisa de ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const h = timers.current[id];
    if (h) {
      clearTimeout(h);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      const t: Toast = {
        id,
        message: opts.message,
        tone: opts.tone ?? "info",
        duration: opts.duration ?? 4000,
        action: opts.action,
      };
      setToasts((prev) => [...prev, t]);
      if (t.duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), t.duration);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ show, dismiss }}>
      {children}
      <div
        className="fixed bottom-4 inset-x-0 flex flex-col items-center gap-2 z-[60] pointer-events-none px-4"
        role="region"
        aria-label="Notificações"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={`pointer-events-auto w-full max-w-md flex items-center gap-3 rounded-xl shadow-lg px-4 py-3 text-sm animate-[fadeIn_.15s_ease-out] ${
              t.tone === "success"
                ? "bg-emerald-600 text-white"
                : t.tone === "error"
                ? "bg-red-600 text-white"
                : "bg-invictus-deep text-white"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={async () => {
                  try {
                    await t.action!.onClick();
                  } finally {
                    dismiss(t.id);
                  }
                }}
                className="font-bold underline underline-offset-2 hover:opacity-80"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Fechar"
              className="opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
