"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Phase } from "@/lib/phases";
import { ProjectDocuments } from "@/components/ProjectDocuments";
import { useDialog } from "@/components/DialogProvider";

interface ProjectDetail {
  id: string;
  address: string | null;
  system_size_kwp: number | null;
  contract_value: number | null;
  paid_amount: number | null;
  payment_method: string | null;
  current_phase: number;
  client: { name: string; phone: string; email: string | null; access_token: string };
  phases: Phase[];
}

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function fmtBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dotColor(status: Phase["status"]) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "in_progress") return "bg-invictus-accent ring-4 ring-invictus-accent/30 animate-pulse";
  return "bg-slate-300";
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [p, setP] = useState<ProjectDetail | null>(null);
  const dialog = useDialog();

  const reload = () => api.get<ProjectDetail>(`/projects/${params.id}`).then(setP);
  useEffect(() => { reload(); }, [params.id]);

  async function complete(phase: Phase) {
    const ok = await dialog.confirm({
      title: "Concluir fase",
      message: `Marcar "${phase.phase_name}" como concluída? O cliente vai receber WhatsApp e push.`,
      confirmText: "Concluir",
    });
    if (!ok) return;
    await api.patch(`/phases/${phase.id}`, { status: "completed" });
    reload();
  }

  async function schedule(phase: Phase) {
    const d = await dialog.prompt({
      title: `Agendar: ${phase.phase_name}`,
      message: "Escolha a data prevista.",
      type: "date",
      defaultValue: phase.scheduled_date ?? "",
      confirmText: "Agendar",
    });
    if (!d) return;
    await api.patch(`/phases/${phase.id}`, { scheduled_date: d, status: "in_progress" });
    reload();
  }

  async function updatePayment() {
    if (!p) return;
    const amount = await dialog.prompt({
      title: "Atualizar pagamento",
      message: "Valor pago acumulado (R$):",
      type: "number",
      defaultValue: String(p.paid_amount ?? 0),
      confirmText: "Próximo",
    });
    if (amount === null) return;
    const method = await dialog.prompt({
      title: "Forma de pagamento",
      message: "pix / boleto / cartao / transferencia / financiamento / outro",
      defaultValue: p.payment_method ?? "pix",
      confirmText: "Salvar",
    });
    if (method === null) return;
    await api.patch(`/projects/${params.id}`, {
      paid_amount: Number(amount),
      payment_method: method,
    });
    reload();
  }

  if (!p) return <p className="text-slate-500">Carregando...</p>;

  const currentPhase = p.phases.find((ph) => ph.phase_number === p.current_phase);
  const nextPhaseNumber = p.current_phase + 1;
  const pct = p.contract_value && p.contract_value > 0
    ? Math.min(100, Math.round(((p.paid_amount ?? 0) / p.contract_value) * 100))
    : 0;

  return (
    <div className="space-y-4 -mx-6 -my-6">
      <div className="bg-invictus text-white px-6 pt-6 pb-10">
        <Link href="/admin" className="text-sm text-white/80 hover:text-white inline-flex items-center gap-1">
          ← Detalhes do projeto
        </Link>
        <h1 className="text-3xl font-bold mt-4">{p.client.name}</h1>
        <p className="text-sm text-white/75 mt-1">
          {p.system_size_kwp ? `${p.system_size_kwp} kWp` : "—"}
          {p.address ? ` • ${p.address}` : ""}
        </p>
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <a href={`tel:${p.client.phone}`} className="text-invictus-accent hover:underline">
            📞 {p.client.phone}
          </a>
          <Link href={`/portal/${p.client.access_token}`} className="text-invictus-accent hover:underline">
            🔗 Link do portal
          </Link>
        </div>
      </div>

      <div className="px-6 -mt-6 max-w-4xl mx-auto w-full space-y-5">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-invictus">Pagamento</h3>
            <button onClick={updatePayment} className="text-xs text-invictus hover:underline">editar</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Contrato</p>
              <p className="font-bold text-invictus-deep">{fmtBRL(p.contract_value)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Pago</p>
              <p className="font-bold text-emerald-600">{fmtBRL(p.paid_amount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase">Método</p>
              <p className="font-bold text-invictus-deep capitalize">{p.payment_method ?? "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-invictus-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-invictus">{pct}% pago</span>
          </div>
        </div>

        <ProjectDocuments projectId={params.id} />

        {currentPhase && (
          <div className="bg-invictus-deep text-white rounded-2xl shadow-card p-5">
            <p className="text-[10px] font-semibold tracking-wider text-invictus-accent uppercase">
              Fase atual ({p.current_phase}/12)
            </p>
            <h2 className="text-2xl font-bold mt-1">{currentPhase.phase_name}</h2>
            {nextPhaseNumber <= 12 && (
              <button
                onClick={() => complete(currentPhase)}
                className="w-full mt-4 py-3 bg-invictus-accent text-invictus-deep font-bold rounded-xl hover:brightness-110 transition"
              >
                ✓ Avançar para fase {nextPhaseNumber}
              </button>
            )}
            <p className="text-[10px] text-white/60 mt-3 tracking-wider uppercase">
              Ao concluir envia WhatsApp + Push para:
            </p>
            <p className="text-xs text-white/85 mt-1">
              {p.client.name} (cliente)
            </p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase mb-3">
            Todas as fases
          </p>
          <ul className="space-y-2.5">
            {p.phases.map((ph) => {
              const isCurrent = ph.status === "in_progress";
              return (
                <li key={ph.id} className="bg-white rounded-2xl shadow-card p-4">
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 w-3 h-3 rounded-full ${dotColor(ph.status)}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${
                        ph.status === "completed" ? "text-slate-800" :
                        isCurrent ? "text-invictus" : "text-slate-400"
                      }`}>
                        {ph.phase_number}. {ph.phase_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ph.completed_date ? `✓ Concluído em ${fmt(ph.completed_date)}` :
                         isCurrent ? "• ATUAL — clique em Avançar acima" :
                         ph.scheduled_date ? `Previsto: ${fmt(ph.scheduled_date)}` :
                         "Sem data — toque para agendar"}
                      </p>
                    </div>
                    {ph.status !== "completed" && !isCurrent && (
                      <button
                        onClick={() => schedule(ph)}
                        className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg font-medium hover:bg-invictus hover:text-white transition"
                      >
                        Agendar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
