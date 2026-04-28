import Link from "next/link";
import { notFound } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import { API_URL } from "@/lib/supabase";
import { Phase, TOTAL_PHASES } from "@/lib/phases";

interface Project {
  id: string;
  address: string | null;
  system_size_kwp: number | null;
  current_phase: number;
  phases: Phase[];
}
interface Resp {
  client: { id: string; name: string; email: string | null; phone: string };
  projects: Project[];
}

async function load(token: string): Promise<Resp | null> {
  try {
    const r = await fetch(`${API_URL}/projects/by-client-token/${token}`, { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
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
    11: "Sistema ativo", 12: "App de monitoramento", 13: "Manutenção agendada",
  };
  return map[n] ?? "Em andamento";
}

export default async function PortalProject({
  params,
}: { params: { token: string; projectId: string } }) {
  const data = await load(params.token);
  if (!data) notFound();
  const project = data.projects.find((p) => p.id === params.projectId);
  if (!project) notFound();

  const currentPhase = project.phases.find((p) => p.phase_number === project.current_phase);
  const nextPhase = project.phases.find((p) => p.status !== "completed" && p.phase_number > project.current_phase)
    ?? project.phases.find((p) => p.status === "in_progress");

  const kwp = project.system_size_kwp ?? 0;
  const monthlyEstimate = Math.round(kwp * 125);

  return (
    <main className="min-h-screen bg-invictus-bg pb-10">
      <header className="bg-invictus text-white px-6 pt-8 pb-10">
        <Link href={`/portal/${params.token}`} className="text-sm text-white/80 hover:text-white inline-flex items-center gap-1">
          ← Meu projeto
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
            <p className="text-xl font-bold text-invictus-accent">{project.current_phase}/{TOTAL_PHASES}</p>
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
      </div>
    </main>
  );
}
