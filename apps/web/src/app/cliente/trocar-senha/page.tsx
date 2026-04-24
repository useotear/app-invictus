"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export default function ClienteTrocarSenha() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/cliente/login");
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/me/change-password", { new_password: password });
      router.replace("/cliente");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/cliente/login");
        return;
      }
      setError(e instanceof Error ? e.message : "Erro ao trocar senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-invictus">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card p-8">
        <h1 className="font-bold text-invictus-deep text-xl mb-1">Defina uma nova senha</h1>
        <p className="text-xs text-slate-500 mb-5">
          Por segurança, troque a senha provisória que a equipe enviou.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="password"
            required
            placeholder="Nova senha (mínimo 8)"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
          />
          <input
            type="password"
            required
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-invictus text-white py-2.5 rounded-lg font-semibold hover:bg-invictus-dark transition disabled:opacity-60"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </main>
  );
}
