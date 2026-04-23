import "./globals.css";
import Script from "next/script";
import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Invictus Solar — Acompanhamento",
  description: "Acompanhe sua instalação fotovoltaica em tempo real",
  manifest: "/manifest.json",
  icons: { icon: "/logo.webp", apple: "/logo.webp" },
};

export const viewport: Viewport = {
  themeColor: "#1e2bd6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = headers().get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>
        {children}
        <Script src="/sw-register.js" strategy="afterInteractive" nonce={nonce} />
      </body>
    </html>
  );
}
