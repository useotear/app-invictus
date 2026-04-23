"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearMeCache } from "@/lib/useMe";

interface SessionUser {
  id: string;
  email: string | null;
}

const AuthContext = { user: null as SessionUser | null };

export function useSessionUser() {
  return AuthContext.user;
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") { setReady(true); return; }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace("/admin/login");
        return;
      }
      AuthContext.user = { id: data.session.user.id, email: data.session.user.email ?? null };
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/admin/login");
      else AuthContext.user = { id: session.user.id, email: session.user.email ?? null };
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (!ready && pathname !== "/admin/login") {
    return <div className="p-6 text-slate-500">Carregando…</div>;
  }
  return <>{children}</>;
}

export async function signOut() {
  clearMeCache();
  await supabase.auth.signOut();
  window.location.href = "/admin/login";
}
