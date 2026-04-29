// Invictus Solar — Service Worker (push + cache básico)

const CACHE = "invictus-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.json"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Limpa caches de versões antigas
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  // Não intercepta cross-origin (API, Supabase, fontes externas).
  // Deixa o browser tratar — senão o fallback "/" devolve HTML pra
  // chamadas que esperam JSON, quebrando o app.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Não intercepta data: blob: chrome-extension: etc.
  if (!url.protocol.startsWith("http")) return;

  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then((r) => r || caches.match("/"))
    )
  );
});

self.addEventListener("push", (e) => {
  let data = { title: "Invictus Solar", body: "Atualização no seu projeto", url: "/" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(clients.openWindow(url));
});
