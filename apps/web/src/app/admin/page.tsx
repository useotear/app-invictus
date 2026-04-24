"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { TOTAL_PHASES } from "@/lib/phases";

interface Project {
  id: string;
  current_phase: number;
  address: string | null;
  system_size_kwp: number | null;
  updated_at?: string | null;
  client: { name: string; phone: string };
  seller: { id: string; name: string } | null;
}

type Filter = "all" | "in_progress" | "late";

function phaseLabel(n: number) {
  const map: Record<number, string> = {
    1: "Contrato assinado", 2: "Compra do kit", 3: "Kit a caminho",
    4: "Kit entregue", 5: "Entrada na Celesc", 6: "Projeto em análise",
    7: "Projeto aprovado", 8: "Instalação agendada", 9: "Instalação concluída",
    10: "Troca do relógio agendada", 11: "Sistema ativo", 12: "Manutenção agendada", 13: "App de monitoramento",
  };
  return map[n] ?? "—";
}

function phaseTint(n: number) {
  if (n >= 11) return "bg-emerald-500";
  if (n >= 8) return "bg-invictus";
  return "bg-invictus-accent text-invictus-deep";
}

export default function AdminHome() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { isAdmin } = useMe();

  useEffect(() => {
    api.get<Project[]>(`/projects`)
      .then((p) => { setProjects(p); setError(null); })
      .catch((e: unknown) => {
        if (e instanceof ApiError) setError(`API ${e.status}: ${e.message}`);
        else if (e instanceof TypeError) setError("Não consegui falar com a API (CORS ou rede).");
        else setError(String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const staleThreshold = Date.now() - 14 * 86_400_000;
    return projects.filter((p) => {
      if (q && !`${p.client.name} ${p.address ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "in_progress" && (p.current_phase >= 11 || p.current_phase <= 0)) return false;
      if (filter === "late") {
        const updatedMs = p.updated_at ? new Date(p.updated_at).getTime() : 0;
        const stale = !updatedMs || updatedMs < staleThreshold;
        const active = p.current_phase < 11 && p.current_phase > 0;
        if (!(stale && active)) return false;
      }
      return true;
    });
  }, [projects, query, filter]);

  const lateCount = useMemo(() => {
    const staleThreshold = Date.now() - 14 * 86_400_000;
    return projects.filter((p) => {
      const updatedMs = p.updated_at ? new Date(p.updated_at).getTime() : 0;
      return (!updatedMs || updatedMs < staleThreshold) && p.current_phase < 11 && p.current_phase > 0;
    }).length;
  }, [projects]);

  function updatedLabel(iso: string | null | undefined) {
    if (!iso) return "sem atualização";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days <= 0) return "hoje";
    if (days === 1) return "ontem";
    if (days < 30) return `há ${days}d`;
    const months = Math.floor(days / 30);
    return `há ${months}mes${months > 1 ? "es" : ""}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-invictus uppercase">Projetos</p>
          <h1 className="text-3xl font-bold text-invictus-deep">Todos os projetos</h1>
        </div>
        <Link href="/admin/clients" className="px-4 py-2 bg-invictus text-white rounded-lg text-sm font-medium hover:bg-invictus-dark transition">
          + Novo cliente / projeto
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm space-y-2">
          <p className="font-semibold">Não foi possível carregar os projetos.</p>
          <p className="text-xs text-red-600/80">
            Verifique sua conexão e tente novamente. Se o problema continuar, avise a equipe técnica.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <details className="text-xs">
              <summary className="cursor-pointer text-red-700/80">Detalhes técnicos</summary>
              <p className="mt-1 font-mono break-all">{error}</p>
              <ul className="list-disc pl-4 mt-1">
                <li><code>SUPABASE_JWT_SECRET</code> setado no serviço api e reiniciado.</li>
                <li><code>ALLOWED_ORIGINS</code> inclui a URL do frontend.</li>
                <li>Usuário existe em <code>users</code> com <code>company_id</code>.</li>
                <li><code>{process.env.NEXT_PUBLIC_API_URL}/health</code> responde JSON.</li>
              </ul>
            </details>
          )}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar cliente, endereço..."
        className="w-full px-4 py-3 bg-white rounded-xl shadow-card placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-invictus"
      />

      <div className="flex gap-2 flex-wrap">
        {([
          ["all", `Todos (${projects.length})`],
          ["in_progress", "Em andamento"],
          ["late", `Sem mexer ${lateCount ? `(${lateCount})` : ""}`.trim()],
        ] as [Filter, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
              filter === k
                ? "bg-invictus text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <ul className="space-y-3" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-center gap-4 bg-white rounded-2xl shadow-card p-4 animate-pulse">
              <div className="shrink-0 w-14 h-14 rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-3">
        {filtered.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/projects/${p.id}`} className="flex items-center gap-4 bg-white rounded-2xl shadow-card p-4 hover:shadow-lg transition">
              <div className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white font-bold ${phaseTint(p.current_phase)}`}>
                <span className="text-xl leading-none">{p.current_phase}</span>
                <span className="text-[9px] opacity-80">/{TOTAL_PHASES}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-invictus-deep truncate">{p.client.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {p.system_size_kwp ? `${p.system_size_kwp} kWp` : "—"}
                  {p.address ? ` • ${p.address}` : ""}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] font-semibold text-invictus-accent bg-invictus-accent/10 px-2 py-0.5 rounded">
                    {phaseLabel(p.current_phase)}
                  </span>
                  <span className="text-[10px] text-slate-400">{updatedLabel(p.updated_at)}</span>
                  {isAdmin && p.seller?.name && (
                    <span className="text-[10px] text-slate-500">• {p.seller.name}</span>
                  )}
                </div>
              </div>
              <span className="text-slate-300 text-lg">›</span>
            </Link>
          </li>
        ))}
        {!loading && !error && filtered.length === 0 && (
          <li className="p-8 text-center text-slate-500 bg-white rounded-2xl shadow-card">
            Nenhum projeto encontrado.
          </li>
        )}
      </ul>
    </div>
  );
}
