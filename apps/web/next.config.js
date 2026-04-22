/** @type {import('next').NextConfig} */

// API_URL vem do build-arg/env; o CSP precisa liberar o domínio do backend
// e do Supabase pra fetch/realtime.
const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseWss = supabaseUrl.replace(/^https?:\/\//, "wss://");

const connectSrc = [
  "'self'",
  apiUrl,
  supabaseUrl,
  supabaseWss,
].filter(Boolean).join(" ");

const csp = [
  "default-src 'self'",
  `connect-src ${connectSrc}`,
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

module.exports = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
