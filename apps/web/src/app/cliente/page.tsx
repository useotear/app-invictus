"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Phase, PHASE_DESCRIPTIONS, TOTAL_PHASES } from "@/lib/phases";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ClienteRealtime } from "./push";

interface Project {
  id: string;
  address: string | null;
  system_size_kwp: number | null;
  contract_value: number | null;
  paid_amount: number | null;
  payment_method: string | null;
  current_phase: number;
  phases: Phase[];
  documents_count: number;
}

interface Me {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  must_change_password: boolean;
}

function projectType(size: number | null) {
  if (!size) return "Projeto";
  return size < 10 ? "Residencial" : "Comercial";
}

function phaseLabel(n: number) {
  const map: Record<number, string> = {
    1: "Contrato assinado", 2: "Compra do kit", 3: "Kit a caminho",
    4: "Kit entregue", 5: "Instalação agendada", 6: "Instalação concluída",
    7: "Entrada na Celesc", 8: "Projeto em análise", 9: "Projeto aprovado",
    10: "Troca do relógio agendada", 11: "Sistema ativo", 12: "App de monitoramento", 13: "Manutenção",
  };
  return map[n] ?? "Em andamento";
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

export default function ClienteDashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/cliente/login");
        return;
      }
      try {
        const [meRes, projRes] = await Promise.all([
          api.get<Me>("/me"),
          api.get<Project[]>("/me/projects"),
        ]);
        setMe(meRes);
        setProjects(projRes);
        if (meRes.must_change_password) router.replace("/cliente/trocar-senha");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await supabase.auth.signOut();
          router.replace("/cliente/login");
          return;
        }
        setErr(e instanceof Error ? e.message : "Erro ao carregar");
      }
    })();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/cliente/login");
  }

  if (err) {
    return (
      <main className="min-h-screen bg-invictus-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-card p-6 space-y-3">
          <h1 className="text-xl font-bold text-invictus-deep">Algo deu errado</h1>
          <p className="text-sm text-slate-600">{err}</p>
          <button onClick={logout} className="text-xs text-invictus hover:underline">Sair</button>
        </div>
      </main>
    );
  }

  if (!me || !projects) {
    return (
      <main className="min-h-screen bg-invictus-bg flex items-center justify-center">
        <p className="text-slate-500 text-sm">Carregando...</p>
      </main>
    );
  }

  if (projects.length === 0) {
    return (
      <main className="min-h-screen bg-invictus-bg p-6">
        <div className="flex justify-end mb-4">
          <button onClick={logout} className="text-xs text-slate-500 hover:underline">Sair</button>
        </div>
        <p className="text-slate-600 text-center py-12">
          Nenhum projeto cadastrado ainda. Entre em contato com a equipe.
        </p>
      </main>
    );
  }

  const primary = projects[0];
  const others = projects.slice(1);
  const pct = Math.round((primary.current_phase / TOTAL_PHASES) * 100);
  const kwp = primary.system_size_kwp ?? 0;
  const nextPhase = primary.phases.find((p) => p.status !== "completed");
  const currentLabel = phaseLabel(primary.current_phase);
  const totalDocs = projects.reduce((s, p) => s + p.documents_count, 0);

  return (
    <main className="min-h-screen bg-invictus-bg pb-28">
      <ClienteRealtime />
      <InstallPrompt />

      <header className="bg-white px-5 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-invictus-bg flex items-center justify-center">
          <span className="text-invictus font-bold text-sm">
            {me.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </span>
        </div>
        <span className="font-bold text-invictus-deep text-lg flex-1">Invictus Soluções</span>
        <button onClick={logout} className="text-xs text-slate-500 hover:text-invictus">Sair</button>
      </header>

      <section
        className="relative overflow-hidden text-white px-6 pt-6 pb-28"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(30,43,214,0.75), rgba(11,19,64,0.72)), url('/hero-solar.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex gap-1 mb-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => {
            const segActive = i < Math.ceil((primary.current_phase / TOTAL_PHASES) * 6);
            return (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${
                  segActive ? "bg-invictus-accent" : "bg-white/20"
                }`}
              />
            );
          })}
        </div>
        <p className="text-xs text-white/75">Fase {primary.current_phase} de {TOTAL_PHASES}</p>
        <h1 className="text-4xl font-bold mt-1 leading-tight">
          Olá, {me.name.split(" ").slice(0, 2).join(" ")}
        </h1>
        <p className="text-sm text-white/80 mt-2">
          {projects.length > 1
            ? `Você tem ${projects.length} projetos em andamento.`
            : `Seu sistema está na fase ${primary.current_phase} de ${TOTAL_PHASES}`}
        </p>
      </section>

      <div className="px-5 -mt-20 space-y-4 relative z-10">
        <Link
          href={`/cliente/projetos/${primary.id}`}
          className="block bg-white rounded-2xl shadow-card overflow-hidden border-l-4 border-invictus-accent"
        >
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-invictus-deep leading-tight">
                  {projectType(kwp)} — {kwp || "—"} kWp
                </h2>
                {primary.address && (
                  <p className="text-sm text-slate-500 mt-0.5">{primary.address}</p>
                )}
              </div>
              <span className="shrink-0 px-3 py-1 bg-invictus-accent/20 text-invictus-deep text-xs font-bold rounded-full">
                Fase {primary.current_phase}/{TOTAL_PHASES}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600 font-medium">Progresso geral</span>
                <span className="text-invictus font-bold">{pct}% concluído</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-invictus rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-700">Status: <b>{currentLabel}</b></span>
            <span className="text-xs font-semibold text-invictus">Ver detalhes →</span>
          </div>
        </Link>

        {nextPhase && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              Próximo passo
            </p>
            <p className="text-lg font-bold text-invictus mt-0.5">{nextPhase.phase_name}</p>
            {nextPhase.scheduled_date ? (
              <>
                <p className="text-xs text-slate-600 mt-1">Agendado para {fmtDate(nextPhase.scheduled_date)}.</p>
                {nextPhase.phase_number === 5 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                    ⚠️ A data poderá sofrer alterações, você será avisado.
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 mt-1">Aguardando data de agendamento.</p>
            )}
            {PHASE_DESCRIPTIONS[nextPhase.phase_number] && (
              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                {PHASE_DESCRIPTIONS[nextPhase.phase_number]}
              </p>
            )}
          </div>
        )}

        <Link
          href={`/cliente/projetos/${primary.id}`}
          className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition"
        >
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              Documentos
            </p>
            <p className="text-base font-bold text-invictus mt-0.5">
              {totalDocs} {totalDocs === 1 ? "disponível" : "disponíveis"}
            </p>
          </div>
          <span className="text-invictus font-bold">→</span>
        </Link>

        {others.length > 0 && (
          <section className="space-y-2 pt-2">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Meus outros projetos
            </p>
            <ul className="space-y-2">
              {others.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/cliente/projetos/${p.id}`}
                    className="flex items-center gap-3 bg-white rounded-2xl shadow-card p-4 hover:shadow-md transition"
                  >
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-invictus-accent/10 text-invictus-deep flex flex-col items-center justify-center font-bold">
                      <span className="text-lg leading-none">{p.current_phase}</span>
                      <span className="text-[9px] opacity-80">/{TOTAL_PHASES}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-invictus-deep truncate">
                        {projectType(p.system_size_kwp)} — {p.system_size_kwp ?? "—"} kWp
                      </p>
                      <p className="text-xs text-slate-500 truncate">{p.address ?? phaseLabel(p.current_phase)}</p>
                    </div>
                    <span className="text-slate-300 text-lg" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
