"use client";

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

type InputType = "text" | "date" | "number";

interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  type?: InputType;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface AlertOptions {
  title: string;
  message?: string;
  tone?: "info" | "success" | "error";
}

type DialogRequest =
  | { kind: "prompt"; opts: PromptOptions; resolve: (v: string | null) => void }
  | { kind: "confirm"; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: AlertOptions; resolve: () => void };

interface DialogApi {
  prompt: (opts: PromptOptions) => Promise<string | null>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  alert: (opts: AlertOptions) => Promise<void>;
}

const DialogCtx = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogCtx);
  if (!ctx) throw new Error("useDialog precisa de DialogProvider");
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (req?.kind === "prompt") setValue(req.opts.defaultValue ?? "");
  }, [req]);

  const close = useCallback(() => setReq(null), []);

  const api: DialogApi = {
    prompt: (opts) =>
      new Promise((resolve) => setReq({ kind: "prompt", opts, resolve })),
    confirm: (opts) =>
      new Promise((resolve) => setReq({ kind: "confirm", opts, resolve })),
    alert: (opts) =>
      new Promise((resolve) => setReq({ kind: "alert", opts, resolve })),
  };

  useEffect(() => {
    if (!req) return;
    function onKey(e: KeyboardEvent) {
      if (!req) return;
      if (e.key === "Escape") {
        if (req.kind === "prompt") (req.resolve as (v: string | null) => void)(null);
        else if (req.kind === "confirm") (req.resolve as (v: boolean) => void)(false);
        else (req.resolve as () => void)();
        close();
      }
      if (e.key === "Enter" && req.kind !== "prompt") {
        if (req.kind === "confirm") (req.resolve as (v: boolean) => void)(true);
        else (req.resolve as () => void)();
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req, close]);

  return (
    <DialogCtx.Provider value={api}>
      {children}
      {req && (
        <div className="fixed inset-0 z-50 bg-invictus-deep/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-invictus text-white px-5 py-4">
              <h3 className="font-bold text-lg">{req.opts.title}</h3>
            </div>
            <div className="p-5 space-y-4">
              {req.opts.message && (
                <p className="text-sm text-slate-600">{req.opts.message}</p>
              )}

              {req.kind === "prompt" && (
                <input
                  autoFocus
                  type={req.opts.type ?? "text"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={req.opts.placeholder}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (req.resolve as (v: string | null) => void)(value);
                      close();
                    }
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
                />
              )}

              <div className="flex gap-2 justify-end pt-1">
                {req.kind !== "alert" && (
                  <button
                    onClick={() => {
                      if (req.kind === "prompt") (req.resolve as (v: string | null) => void)(null);
                      else (req.resolve as (v: boolean) => void)(false);
                      close();
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    {(req.kind === "prompt" ? req.opts.cancelText : req.opts.cancelText) ?? "Cancelar"}
                  </button>
                )}
                <button
                  autoFocus={req.kind !== "prompt"}
                  onClick={() => {
                    if (req.kind === "prompt") (req.resolve as (v: string | null) => void)(value);
                    else if (req.kind === "confirm") (req.resolve as (v: boolean) => void)(true);
                    else (req.resolve as () => void)();
                    close();
                  }}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition ${
                    req.kind === "confirm" && req.opts.danger
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-invictus-accent text-invictus-deep hover:brightness-110"
                  }`}
                >
                  {(req.kind === "alert"
                    ? "OK"
                    : req.kind === "prompt"
                    ? req.opts.confirmText ?? "Confirmar"
                    : req.opts.confirmText ?? "Confirmar")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}
