import { API_URL } from "./supabase";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  get:   <T>(p: string) => req<T>(p),
  post:  <T>(p: string, body: unknown) => req<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) => req<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
};
