import { NextRequest, NextResponse } from "next/server";

/**
 * CSP com nonce por request. Padrão recomendado pelo Next 14 porque o
 * framework injeta inline scripts de hidratação que precisam de um nonce.
 *
 * Em dev: libera unsafe-inline/eval pro React Refresh.
 * Em prod: nonce + strict-dynamic (scripts com nonce propagam confiança
 * pros chunks que eles carregam — sem precisar listar hashes).
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseWss = supabaseUrl.replace(/^https?:\/\//, "wss://");

  const connectSrc = [
    "'self'",
    apiUrl,
    supabaseUrl,
    supabaseWss,
    isDev ? "ws: wss:" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const csp = [
    "default-src 'self'",
    `connect-src ${connectSrc}`,
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icons|Invictus-icon.png|Invictus-Logo-branca.png|Invictus-Logo-site.png|manifest.json|sw.js|sw-register.js|hero-solar.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
