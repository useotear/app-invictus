"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard, signOut } from "./AuthGuard";
import { AdminPushSubscribe } from "./push";
import { DialogProvider } from "@/components/DialogProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { useMe } from "@/lib/useMe";

import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  seller: "Vendedor",
  homologation: "Homologação",
  installer: "Instalação",
  scheduler: "Agendador",
};

function RoleBadge() {
  const { me } = useMe();
  if (!me) return null;
  return (
    <span className="text-[10px] font-semibold tracking-wider uppercase bg-invictus-accent/20 text-invictus-accent px-2 py-1 rounded-full">
      {ROLE_LABELS[me.role] ?? me.role}
    </span>
  );
}

const NAV_ITEMS = [
  { href: "/admin", label: "Projetos" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/cronograma", label: "Cronograma" },
  { href: "/admin/manutencao", label: "Manutenção" },
  { href: "/admin/perfil", label: "Perfil" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AuthGuard>
      <ToastProvider>
      <DialogProvider>
      {!isLogin && <AdminPushSubscribe />}
      <div className="min-h-screen flex flex-col bg-invictus-bg">
        {!isLogin && (
          <header className="bg-invictus text-white">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex gap-3 items-center">
              <Link href="/admin" onClick={() => setMenuOpen(false)} className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold tracking-[0.2em] text-invictus-accent uppercase">
                  Invictus
                </span>
                <span className="font-bold text-base sm:text-lg">Painel</span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex gap-5 text-sm ml-4">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`transition ${active ? "text-invictus-accent" : "hover:text-invictus-accent"}`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="ml-auto hidden md:flex items-center gap-3">
                <RoleBadge />
                <button
                  onClick={signOut}
                  className="text-xs text-white/70 hover:text-invictus-accent"
                >
                  Sair
                </button>
              </div>

              {/* Mobile burger */}
              <button
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="md:hidden ml-auto p-2 -mr-2 rounded-lg hover:bg-white/10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

            {/* Mobile dropdown */}
            {menuOpen && (
              <nav className="md:hidden border-t border-white/10 px-4 py-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm ${
                        active ? "bg-invictus-accent/20 text-invictus-accent" : "hover:bg-white/10"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/10">
                  <RoleBadge />
                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    className="text-xs text-white/80 hover:text-invictus-accent px-3 py-1.5 rounded-lg hover:bg-white/10"
                  >
                    Sair
                  </button>
                </div>
              </nav>
            )}
          </header>
        )}
        <main className={isLogin ? "flex-1" : "flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full"}>
          {children}
        </main>
      </div>
      </DialogProvider>
      </ToastProvider>
    </AuthGuard>
  );
}
