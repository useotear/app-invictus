import { API_URL, supabase } from "./supabase";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
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
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new ApiError(`${r.status} ${text || r.statusText}`.trim(), r.status);
  }
  // Resposta OK mas não-JSON (ex: proxy retornou HTML) — mensagem clara em vez de SyntaxError.
  const contentType = r.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await r.text().catch(() => "");
    const preview = text.slice(0, 200).replace(/\s+/g, " ");
    throw new ApiError(
      `Resposta não-JSON da API (${contentType || "sem content-type"}): ${preview}`,
      r.status,
    );
  }
  try {
    return await r.json();
  } catch (e) {
    throw new ApiError(
      `Falha ao decodificar JSON da API: ${e instanceof Error ? e.message : "erro"}`,
      r.status,
    );
  }
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body: unknown) =>
    req<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) =>
    req<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
};
