"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

const DISMISS_KEY = "invictus-install-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari não dispara beforeinstallprompt; guia manualmente.
    if (isIOS()) {
      const t = setTimeout(() => setShowIosTip(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setDeferred(null);
      setVisible(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setShowIosTip(false);
  }

  if (showIosTip && !visible) {
    return (
      <div className="fixed bottom-20 inset-x-4 z-40 bg-invictus-deep text-white rounded-2xl shadow-xl p-4 flex items-start gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm">Instale o app no seu iPhone</p>
          <p className="text-xs text-white/80 mt-1">
            Toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="text-white/60 hover:text-white text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
    );
  }

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-20 inset-x-4 z-40 bg-invictus text-white rounded-2xl shadow-xl p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className="font-semibold text-sm">Instalar Invictus no celular</p>
        <p className="text-xs text-white/80 mt-0.5">
          Acesso rápido e notificações quando seu projeto avançar.
        </p>
      </div>
      <button
        onClick={install}
        className="shrink-0 bg-invictus-accent text-invictus-deep font-bold px-3 py-2 rounded-lg text-sm hover:brightness-110 transition"
      >
        Instalar
      </button>
      <button
        onClick={dismiss}
        aria-label="Agora não"
        className="shrink-0 text-white/60 hover:text-white text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
