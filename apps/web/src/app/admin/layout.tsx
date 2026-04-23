"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGuard, signOut } from "./AuthGuard";
import { DialogProvider } from "@/components/DialogProvider";
import { ToastProvider } from "@/components/ToastProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  return (
    <AuthGuard>
      <ToastProvider>
      <DialogProvider>
      <div className="min-h-screen flex flex-col bg-invictus-bg">
        {!isLogin && (
          <header className="bg-invictus text-white">
            <div className="max-w-6xl mx-auto px-6 py-4 flex gap-6 items-center">
              <Link href="/admin" className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold tracking-[0.2em] text-invictus-accent uppercase">
                  Invictus • Admin
                </span>
                <span className="font-bold text-lg">Painel</span>
              </Link>
              <nav className="flex gap-5 text-sm ml-4">
                <Link href="/admin" className="hover:text-invictus-accent transition">Projetos</Link>
                <Link href="/admin/clients" className="hover:text-invictus-accent transition">Clientes</Link>
              </nav>
              <button
                onClick={signOut}
                className="ml-auto text-xs text-white/70 hover:text-invictus-accent"
              >
                Sair
              </button>
            </div>
          </header>
        )}
        <main className={isLogin ? "flex-1" : "flex-1 p-6 max-w-6xl mx-auto w-full"}>
          {children}
        </main>
      </div>
      </DialogProvider>
      </ToastProvider>
    </AuthGuard>
  );
}
