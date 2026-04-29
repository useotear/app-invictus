import Link from "next/link";
import { PortalRealtime } from "./realtime";
import { InstallPrompt } from "@/components/InstallPrompt";
import { API_URL } from "@/lib/supabase";
import { Phase, PHASE_DESCRIPTIONS, TOTAL_PHASES } from "@/lib/phases";

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

type LoadResult =
  | { ok: true; data: Resp }
  | { ok: false; status: number; detail: string };

async function load(token: string): Promise<LoadResult> {
  const url = `${API_URL}/projects/by-client-token/${token}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      let detail = r.statusText;
      try {
        const body = await r.json();
        if (body?.detail) detail = body.detail;
      } catch { /* ignore */ }
      return { ok: false, status: r.status, detail };
    }
    return { ok: true, data: await r.json() };
  } catch (e) {
    return { ok: false, status: 0, detail: e instanceof Error ? e.message : "Erro de rede" };
  }
}

function ErrorScreen({ title, message, url }: { title: string; message: string; url?: string }) {
  const isDev = process.env.NODE_ENV !== "production";
  return (
    <main className="min-h-screen bg-invictus-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-card p-6 space-y-3">
        <h1 className="text-xl font-bold text-invictus-deep">{title}</h1>
        <p className="text-sm text-slate-600">{message}</p>
        {isDev && url && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer">Detalhes (dev)</summary>
            <p className="mt-1 font-mono break-all">{url}</p>
          </details>
        )}
      </div>
    </main>
  );
}

function projectType(size: number | null) {
  if (!size) return "Projeto";
  return size < 10 ? "Residencial" : "Comercial";
}

function phaseLabel(n: number) {
  const map: Record<number, string> = {
    1: "Contrato assinado", 2: "Compra do kit", 3: "Kit a caminho",
    4: "Kit entregue", 5: "Instalação agendada", 6: "Entrada na Celesc",
    7: "Projeto em análise", 8: "Projeto aprovado", 9: "Instalação concluída",
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

function fmtBRLmil(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)} mi`;
  if (v >= 1000) return `R$ ${Math.round(v / 1000)} mil`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default async function Portal({ params }: { params: { token: string } }) {
  const result = await load(params.token);
  const debugUrl = `${API_URL}/projects/by-client-token/${params.token}`;

  if (!result.ok) {
    if (result.status === 404) {
      return <ErrorScreen
        title="Link inválido"
        message="Esse link não existe ou foi substituído. Peça à equipe Invictus um novo link."
        url={debugUrl}
      />;
    }
    if (result.status === 410) {
      return <ErrorScreen
        title="Link expirado"
        message={result.detail || "Por segurança, os links do portal expiram. Peça à equipe um novo link."}
        url={debugUrl}
      />;
    }
    if (result.status === 0) {
      return <ErrorScreen
        title="Não consegui falar com o servidor"
        message="Verifique sua conexão e tente novamente em alguns instantes."
        url={debugUrl}
      />;
    }
    return <ErrorScreen
      title="Algo deu errado"
      message={`${result.status} — ${result.detail}`}
      url={debugUrl}
    />;
  }

  const { client, projects } = result.data;

  if (projects.length === 0) {
    return (
      <main className="min-h-screen bg-invictus-bg p-6">
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
  // Estimativas: yield SC ~1,40 MWh/kWp/ano, fator SIN 2024 ~0,076 tCO2/MWh.
  // Tarifa por porte: B1 residencial (R$0,85), comercial pequeno (R$0,75), Grupo A (R$0,60).
  // Lei 14.300/2022: minigeração (>75 kW) paga ~18% TUSD sobre injeção em 2026.
  const geracaoMWh = Math.round(kwp * 1.4);
  const co2Ton = +(geracaoMWh * 0.076).toFixed(1);
  const tarifa = kwp <= 10 ? 0.85 : kwp <= 75 ? 0.75 : 0.6;
  const fioBFactor = kwp > 75 ? 0.82 : 1;
  const economiaBRL = Math.round(geracaoMWh * 1000 * tarifa * fioBFactor);
  const nextPhase = primary.phases.find((p) => p.status !== "completed");
  const currentLabel = phaseLabel(primary.current_phase);
  const totalDocs = projects.reduce((s, p) => s + p.documents_count, 0);

  return (
    <main className="min-h-screen bg-invictus-bg pb-28">
      <PortalRealtime token={params.token} />
      <InstallPrompt />

      <header className="bg-white px-5 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-invictus-bg flex items-center justify-center">
          <span className="text-invictus font-bold text-sm">
            {client.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </span>
        </div>
        <span className="font-bold text-invictus-deep text-lg flex-1">Invictus Soluções</span>
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
          Olá, {client.name.split(" ").slice(0, 2).join(" ")}
        </h1>
        <p className="text-sm text-white/80 mt-2">
          {projects.length > 1
            ? `Você tem ${projects.length} projetos em andamento.`
            : `Seu sistema está na fase ${primary.current_phase} de ${TOTAL_PHASES}`}
        </p>
      </section>

      <div className="px-5 -mt-20 space-y-4 relative z-10">
        <Link
          href={`/portal/${params.token}/${primary.id}`}
          className="block bg-white rounded-2xl shadow-card overflow-hidden border-l-4 border-invictus-accent"
        >
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-11 h-11 rounded-full bg-invictus flex items-center justify-center" aria-hidden="true">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v1H2V5zm0 3h16v9a2 2 0 01-2 2H4a2 2 0 01-2-2V8zm3 3a1 1 0 100 2h2a1 1 0 100-2H5zm0 4a1 1 0 100 2h10a1 1 0 100-2H5z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-invictus-deep leading-tight">
                  {projectType(kwp)} — {kwp || "—"} kWp
                </h2>
                {primary.address && (
                  <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                    </svg>
                    {primary.address}
                  </p>
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
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center" aria-hidden="true">
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
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-11 h-11 rounded-full bg-invictus flex items-center justify-center" aria-hidden="true">
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
                    <svg className="w-3.5 h-3.5 text-invictus" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M6 2a1 1 0 011 1v1h6V3a1 1 0 112 0v1h1a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 011-1zm0 5h8a1 1 0 010 2H6a1 1 0 010-2z" clipRule="evenodd"/>
                    </svg>
                    Agendado para {fmtDate(nextPhase.scheduled_date)}.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Aguardando data de agendamento.</p>
                )}
              </div>
            </div>
            {PHASE_DESCRIPTIONS[nextPhase.phase_number] && (
              <details className="group mt-3 pl-14">
                <summary className="cursor-pointer list-none text-xs font-semibold text-invictus hover:underline flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.05 5.05a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 11-1.414-1.414L10.586 10 7.05 6.464a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                  O que acontece nessa etapa?
                </summary>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {PHASE_DESCRIPTIONS[nextPhase.phase_number]}
                </p>
              </details>
            )}
          </div>
        )}

        <Link
          href={`/portal/${params.token}/${primary.id}#documentos`}
          className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3 hover:shadow-md transition"
        >
          <div className="shrink-0 w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center" aria-hidden="true">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              Documentos
            </p>
            <p className="text-base font-bold text-invictus mt-0.5">
              {totalDocs} {totalDocs === 1 ? "disponível" : "disponíveis"}
            </p>
          </div>
          <span className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center" aria-hidden="true">
            <svg className="w-4 h-4 text-invictus" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>

        <div className="bg-invictus-deep text-white rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold">Resumo do sistema</h3>
            <Link href={`/portal/${params.token}/${primary.id}`} className="text-xs text-invictus-accent hover:underline">
              Ver mais →
            </Link>
          </div>
          <p className="text-[10px] text-white/60 mb-4">Estimativas com base na sua potência instalada e referências de SC.</p>
          <div className="grid grid-cols-4 gap-2">
            <Stat icon="⚡" value={`${kwp || "—"}`} unit="kWp" label="Potência instalada" />
            <Stat icon="☀️" value={geracaoMWh.toLocaleString("pt-BR")} unit="MWh" label="Geração estimada/ano" />
            <Stat icon="🌱" value={co2Ton.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} unit="t" label="CO₂ evitado/ano" />
            <Stat icon="💰" value={fmtBRLmil(economiaBRL).replace("R$ ", "R$")} unit="" label="Economia anual estimada" />
          </div>
        </div>

        {others.length > 0 && (
          <section className="space-y-2 pt-2">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
              Meus outros projetos
            </p>
            <ul className="space-y-2">
              {others.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/portal/${params.token}/${p.id}`}
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

        {(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || process.env.NEXT_PUBLIC_SUPPORT_PHONE) && (
          <aside className="bg-white rounded-2xl shadow-sm p-5 text-sm text-slate-600">
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-2">
              Precisa de ajuda?
            </p>
            <p className="mb-3">Fale com a equipe Invictus.</p>
            <div className="flex gap-2">
              {process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP && (
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-emerald-500 text-white font-semibold py-2.5 rounded-xl hover:brightness-110 transition"
                >
                  WhatsApp
                </a>
              )}
              {process.env.NEXT_PUBLIC_SUPPORT_PHONE && (
                <a
                  href={`tel:${process.env.NEXT_PUBLIC_SUPPORT_PHONE}`}
                  className="flex-1 text-center bg-invictus text-white font-semibold py-2.5 rounded-xl hover:bg-invictus-dark transition"
                >
                  Ligar
                </a>
              )}
            </div>
          </aside>
        )}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex px-2 py-2 justify-around z-20">
        <NavItem href={`/portal/${params.token}`} active label="Home" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
        }/>
        <NavItem href={`/portal/${params.token}/${primary.id}`} label="Status" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a.5.5 0 000 1h5a.5.5 0 000-1h-5z" clipRule="evenodd"/></svg>
        }/>
        <NavItem href={`/portal/${params.token}/${primary.id}#documentos`} label="Docs" icon={
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd"/></svg>
        }/>
      </nav>
    </main>
  );
}

function Stat({ icon, value, unit, label }: { icon: string; value: string; unit: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl mb-1" aria-hidden="true">{icon}</div>
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
      aria-current={active ? "page" : undefined}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl transition ${
        active ? "bg-invictus-bg text-invictus" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
    </Link>
  );
}
