"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { API_URL } from "@/lib/supabase";

/**
 * Inscreve o admin/vendedor logado pra receber push.
 * Roda silenciosamente; se o usuário negar a permissão ou o browser
 * não suportar, simplesmente não faz nada.
 */
export function AdminPushSubscribe() {
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        // Não força o pop-up imediato — só usa permissão se já tiver sido concedida
        // ou se o usuário responder afirmativamente.
        const perm = Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
        if (perm !== "granted") return;

        const keyResp = await fetch(`${API_URL}/push/vapid-public-key`).then((r) => r.json());
        if (!keyResp.key) return;

        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(keyResp.key),
        });

        const raw = sub.toJSON();
        await api.post("/push/subscribe-user", {
          endpoint: sub.endpoint,
          p256dh: raw.keys?.p256dh,
          auth: raw.keys?.auth,
        });
      } catch { /* silencioso */ }
    })();
  }, []);

  return null;
}

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
