import { API_URL, supabase } from "./supabase";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeaders();
  const r = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (r.status === 401) {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") window.location.href = "/admin/login";
    throw new Error("Sessão expirada");
  }
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body: unknown) =>
    req<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) =>
    req<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
};
