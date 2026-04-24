"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Phase } from "@/lib/phases";

interface Document {
  id: string;
  name: string;
  file_url: string;
  created_at: string;
}

interface Project {
  id: string;
  address: string | null;
  system_size_kwp: number | null;
  current_phase: number;
  phases: Phase[];
  documents: Document[];
}

function projectType(size: number | null) {
  if (!size) return "Seu projeto";
  return size < 10 ? "Residencial" : "Comercial";
}

function phaseBadgeLabel(n: number) {
  const map: Record<number, string> = {
    1: "Contrato assinado", 2: "Kit comprado", 3: "Kit a caminho",
    4: "Kit entregue", 5: "Projeto na Celesc", 6: "Projeto em análise",
    7: "Projeto aprovado pela Celesc", 8: "Instalação agendada",
    9: "Instalação concluída", 10: "Troca do relógio agendada",
    11: "Sistema ativo", 12: "Manutenção agendada",
  };
  return map[n] ?? "Em andamento";
}

export default function ClienteProjeto({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/cliente/login");
        return;
      }
      try {
        const p = await api.get<Project>(`/me/projects/${params.id}`);
        setProject(p);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          await supabase.auth.signOut();
          router.replace("/cliente/login");
          return;
        }
        if (e instanceof ApiError && e.status === 404) {
          setErr("Projeto não encontrado.");
          return;
        }
        setErr(e instanceof Error ? e.message : "Erro ao carregar");
      }
    })();
  }, [params.id, router]);

  if (err) {
    return (
      <main className="min-h-screen bg-invictus-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-card p-6 space-y-3">
          <h1 className="text-xl font-bold text-invictus-deep">{err}</h1>
          <Link href="/cliente" className="text-xs text-invictus hover:underline">Voltar</Link>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-invictus-bg flex items-center justify-center">
        <p className="text-slate-500 text-sm">Carregando...</p>
      </main>
    );
  }

  const currentPhase = project.phases.find((p) => p.phase_number === project.current_phase);
  const nextPhase = project.phases.find((p) => p.status !== "completed" && p.phase_number > project.current_phase)
    ?? project.phases.find((p) => p.status === "in_progress");
  const kwp = project.system_size_kwp ?? 0;
  const monthlyEstimate = Math.round(kwp * 125);

  return (
    <main className="min-h-screen bg-invictus-bg pb-10">
      <header className="bg-invictus text-white px-6 pt-8 pb-10">
        <Link href="/cliente" className="text-sm text-white/80 hover:text-white inline-flex items-center gap-1">
          ← Voltar
        </Link>
        <div className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 bg-invictus-accent/20 text-invictus-accent rounded-full text-[10px] font-semibold tracking-wider uppercase">
          ● {phaseBadgeLabel(project.current_phase)}
        </div>
        <h1 className="text-3xl font-bold mt-3">
          {projectType(kwp)} {kwp ? `${kwp} kWp` : ""}
        </h1>
        {project.address && <p className="text-sm text-white/75 mt-1">{project.address}</p>}
      </header>

      <div className="px-4 max-w-xl mx-auto -mt-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-card p-3">
            <p className="text-xl font-bold text-invictus">{kwp || "—"}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">kWp instalados</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3">
            <p className="text-xl font-bold text-invictus">{monthlyEstimate || "—"}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">kWh/mês estimado</p>
          </div>
          <div className="bg-white rounded-xl shadow-card p-3">
            <p className="text-xl font-bold text-invictus-accent">{project.current_phase}/12</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">fase atual</p>
          </div>
        </div>

        {nextPhase && (
          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-[10px] font-semibold tracking-wider text-invictus-accent uppercase">Próxima etapa</p>
            <h3 className="text-lg font-bold text-invictus mt-1">{nextPhase.phase_name}</h3>
            {nextPhase.scheduled_date && (
              <p className="text-sm text-slate-600 mt-2">
                {new Date(nextPhase.scheduled_date).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            )}
            {nextPhase.notes && (
              <p className="text-xs text-slate-500 mt-1">{nextPhase.notes}</p>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-invictus mb-4">Andamento da instalação</h3>
          <Timeline phases={project.phases} />
        </div>

        {project.documents && project.documents.length > 0 && (
          <div id="documentos" className="bg-white rounded-2xl shadow-card p-5">
            <h3 className="font-bold text-invictus mb-3">Documentos</h3>
            <ul className="space-y-2">
              {project.documents.map((d) => (
                <li key={d.id}>
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
                  >
                    <span className="text-sm text-slate-700 truncate">{d.name}</span>
                    <span className="text-xs text-invictus shrink-0 ml-2">abrir ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
