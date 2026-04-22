import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalRealtime } from "./realtime";
import { API_URL } from "@/lib/supabase";
import { Phase } from "@/lib/phases";

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
  if (!size) return "Projeto";
  return size < 10 ? "Residencial" : "Comercial";
}

function phaseLabel(n: number) {
  const map: Record<number, string> = {
    1: "Contrato assinado", 2: "Compra do kit", 3: "Kit a caminho",
    4: "Kit entregue", 5: "Entrada na Celesc", 6: "Análise Técnica",
    7: "Projeto aprovado", 8: "Instalação agendada", 9: "Instalação concluída",
    10: "Troca do relógio agendada", 11: "Sistema ativo", 12: "Manutenção",
  };
  return map[n] ?? "Em andamento";
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

function fmtBRLmil(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)} mi`;
  if (v >= 1000) return `R$ ${Math.round(v / 1000)} mil`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default async function Portal({ params }: { params: { token: string } }) {
  const data = await load(params.token);
  if (!data) notFound();
  const { client, projects } = data;

  if (projects.length === 0) {
    return (
      <main className="min-h-screen bg-invictus-bg p-6">
        <p className="text-slate-600 text-center py-12">
          Nenhum projeto cadastrado ainda. Entre em contato com a equipe.
        </p>
      </main>
    );
  }

  // Mostra o primeiro (e futuramente mais ativo); client pode navegar via dashboards
  const project = projects[0];
  const pct = Math.round((project.current_phase / 12) * 100);
  const kwp = project.system_size_kwp ?? 0;
  // Referências: yield SC ~1,40 MWh/kWp/ano, fator SIN 2024 ~0,076 tCO2/MWh,
  // tarifa residencial média SC ~R$ 0,85/kWh.
  const geracaoMWh = Math.round(kwp * 1.4);
  const co2Ton = +(geracaoMWh * 0.076).toFixed(1);
  const economiaBRL = Math.round(geracaoMWh * 1000 * 0.85);
  const nextPhase = project.phases.find((p) => p.status !== "completed");
  const currentLabel = phaseLabel(project.current_phase);

  return (
    <main className="min-h-screen bg-invictus-bg pb-28">
      <PortalRealtime token={params.token} />

      <header className="bg-white px-5 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-invictus-bg flex items-center justify-center">
          <span className="text-invictus font-bold text-sm">
            {client.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </span>
        </div>
        <span className="font-bold text-invictus-deep text-lg flex-1">SolarTrack</span>
        <button className="relative p-1" aria-label="Notificações">
          <svg className="w-6 h-6 text-invictus" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
          </svg>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-invictus-accent" />
        </button>
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
        <div className="flex gap-1 mb-3">
          {Array.from({ length: 6 }).map((_, i) => {
            const segActive = i < Math.ceil((project.current_phase / 12) * 6);
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
        <p className="text-xs text-white/75">Fase {project.current_phase} de 12</p>
        <h1 className="text-4xl font-bold mt-1 leading-tight">
          Olá, {client.name.split(" ").slice(0, 2).join(" ")}
        </h1>
        <p className="text-sm text-white/80 mt-2">
          Seu sistema está na fase {project.current_phase} de 12
        </p>
      </section>

      <div className="px-5 -mt-20 space-y-4 relative z-10">
        <Link
          href={`/portal/${params.token}/${project.id}`}
          className="block bg-white rounded-2xl shadow-card overflow-hidden border-l-4 border-invictus-accent"
        >
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-11 h-11 rounded-full bg-invictus flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v1H2V5zm0 3h16v9a2 2 0 01-2 2H4a2 2 0 01-2-2V8zm3 3a1 1 0 100 2h2a1 1 0 100-2H5zm0 4a1 1 0 100 2h10a1 1 0 100-2H5z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-invictus-deep leading-tight">
                  {projectType(kwp)} — {kwp || "—"} kWp
                </h2>
                {project.address && (
                  <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                    </svg>
                    {project.address}
                  </p>
                )}
              </div>
              <span className="shrink-0 px-3 py-1 bg-invictus-accent/20 text-invictus-deep text-xs font-bold rounded-full">
                Fase {project.current_phase}/12
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
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-4 h-4 text-invictus" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
                </svg>
              </div>
              <span className="text-sm text-slate-700">Status: <b>{currentLabel}</b></span>
            </div>
            <span className="text-xs font-semibold text-invictus">Ver detalhes →</span>
          </div>
        </Link>

        {nextPhase && (
          <div className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-full bg-invictus flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                Próximo passo
              </p>
              <p className="text-lg font-bold text-invictus mt-0.5">{nextPhase.phase_name}</p>
              {nextPhase.scheduled_date ? (
                <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-invictus" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 011 1v1h6V3a1 1 0 112 0v1h1a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 011-1zm0 5h8a1 1 0 010 2H6a1 1 0 010-2z" clipRule="evenodd"/>
                  </svg>
                  Agendado para {fmtDate(nextPhase.scheduled_date)}.
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">Aguardando data de agendamento.</p>
              )}
            </div>
            <span className="text-slate-300 text-xl self-center">›</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3">
          <div className="shrink-0 w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              Documentos
            </p>
            <p className="text-base font-bold text-invictus mt-0.5">
              {project.documents_count} {project.documents_count === 1 ? "disponível" : "disponíveis"}
            </p>
          </div>
          <Link
            href={`/portal/${params.token}/${project.id}#documentos`}
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition"
            aria-label="Ver documentos"
          >
            <svg className="w-4 h-4 text-invictus" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </Link>
        </div>

        <div className="bg-invictus-deep text-white rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Resumo do sistema</h3>
            <Link href={`/portal/${params.token}/${project.id}`} className="text-xs text-invictus-accent hover:underline">
              Ver mais →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Stat icon="⚡" value={`${kwp || "—"}`} unit="kWp" label="Potência instalada" />
            <Stat icon="☀️" value={geracaoMWh.toLocaleString("pt-BR")} unit="MWh" label="Geração estimada/ano" />
            <Stat icon="🌱" value={co2Ton.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} unit="t" label="CO₂ evitado/ano" />
            <Stat icon="💰" value={fmtBRLmil(economiaBRL).replace("R$ ", "R$")} unit="" label="Economia anual" />
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex px-2 py-2 justify-around z-20">
        <NavItem href={`/portal/${params.token}`} active label="Home" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
        }/>
        <NavItem href={`/portal/${params.token}/${project.id}`} label="Status" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a.5.5 0 000 1h5a.5.5 0 000-1h-5z" clipRule="evenodd"/></svg>
        }/>
        <NavItem href={`/portal/${params.token}#perfil`} label="Perfil" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>
        }/>
      </nav>
    </main>
  );
}

function Stat({ icon, value, unit, label }: { icon: string; value: string; unit: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl mb-1">{icon}</div>
      <p className="font-bold text-sm leading-tight">
        {value}
        {unit && <span className="text-[10px] font-medium ml-0.5 opacity-90">{unit}</span>}
      </p>
      <p className="text-[9px] text-white/70 mt-1 leading-tight">{label}</p>
    </div>
  );
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition ${
        active ? "bg-invictus-bg text-invictus" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}
