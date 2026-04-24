"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Phase } from "@/lib/phases";
import { ProjectDocuments } from "@/components/ProjectDocuments";
import { InstallationNotesCard } from "@/components/InstallationNotesCard";
import { InstallChecklist, ChecklistState } from "@/components/InstallChecklist";
import { useDialog } from "@/components/DialogProvider";
import { useToast } from "@/components/ToastProvider";

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "financiamento", label: "Financiamento" },
  { value: "outro", label: "Outro" },
];

const ADVANCE_DELAY_MS = 5000;

interface ProjectDetail {
  id: string;
  address: string | null;
  location_link: string | null;
  installation_notes: string | null;
  system_size_kwp: number | null;
  contract_value: number | null;
  paid_amount: number | null;
  payment_method: string | null;
  current_phase: number;
  client: { name: string; phone: string; email: string | null; access_token: string };
  seller: { id: string; name: string } | null;
  phases: Phase[];
}

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);
  const dialog = useDialog();
  const toast = useToast();
  const pendingAdvance = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = () => api.get<ProjectDetail>(`/projects/${params.id}`).then(setP);
  useEffect(() => { reload(); }, [params.id]);

  useEffect(() => {
    return () => {
      if (pendingAdvance.current) clearTimeout(pendingAdvance.current);
    };
  }, []);

  function previewMessage(phase: Phase) {
    if (!p) return "";
    const firstName = p.client.name.split(" ")[0];
    return `Olá ${firstName}! Seu projeto avançou para a fase ${phase.phase_number}: ${phase.phase_name}. Acompanhe em tempo real no seu portal.`;
  }

  async function complete(phase: Phase) {
    const today = new Date().toISOString().slice(0, 10);
    const completedDate = await dialog.prompt({
      title: "Data de conclusão",
      message: `Em que dia esta fase foi concluída? (padrão: hoje)\n\n"${phase.phase_name}"`,
      type: "date",
      defaultValue: today,
      confirmText: "Avançar",
    });
    if (completedDate === null) return;
    const chosenDate = completedDate || today;

    if (pendingAdvance.current) clearTimeout(pendingAdvance.current);
    let cancelled = false;

    toast.show({
      message: `Avançando "${phase.phase_name}"...`,
      tone: "info",
      duration: ADVANCE_DELAY_MS,
      action: {
        label: "Desfazer",
        onClick: () => {
          cancelled = true;
          if (pendingAdvance.current) {
            clearTimeout(pendingAdvance.current);
            pendingAdvance.current = null;
          }
          toast.show({ message: "Avanço cancelado. Nada foi enviado.", tone: "success", duration: 3000 });
        },
      },
    });

    pendingAdvance.current = setTimeout(async () => {
      pendingAdvance.current = null;
      if (cancelled) return;
      try {
        await api.patch(`/phases/${phase.id}`, { status: "completed", completed_date: chosenDate });
        toast.show({ message: "Fase avançada. Cliente notificado.", tone: "success", duration: 3000 });
        reload();
      } catch (e) {
        toast.show({
          message: e instanceof Error ? e.message : "Falha ao avançar fase",
          tone: "error",
          duration: 5000,
        });
      }
    }, ADVANCE_DELAY_MS);
  }

  async function schedule(phase: Phase) {
    const d = await dialog.prompt({
      title: `Agendar: ${phase.phase_name}`,
      message: "Escolha a data prevista. Deixe em branco para remover.",
      type: "date",
      defaultValue: phase.scheduled_date ?? "",
      confirmText: "Salvar",
    });
    if (d === null) return;
    // Não mexe no status — só a conclusão do projeto avança fases.
    await api.patch(`/phases/${phase.id}`, { scheduled_date: d || null });
    toast.show({
      message: d ? `Agendado para ${new Date(d).toLocaleDateString("pt-BR")}` : "Agendamento removido",
      tone: "success",
      duration: 3000,
    });
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
      type: "select",
      options: PAYMENT_METHODS,
      defaultValue: p.payment_method ?? "pix",
      confirmText: "Salvar",
    });
    if (method === null) return;
    await api.patch(`/projects/${params.id}`, {
      paid_amount: Number(amount),
      payment_method: method,
    });
    toast.show({ message: "Pagamento atualizado.", tone: "success", duration: 3000 });
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
          {p.location_link && (
            <a href={p.location_link} target="_blank" rel="noopener noreferrer" className="text-invictus-accent hover:underline">
              📍 Localização
            </a>
          )}
          {p.seller?.name && (
            <span className="text-white/60">
              Vendedor: <b className="text-white/85">{p.seller.name}</b>
            </span>
          )}
        </div>
      </div>

      <div className="px-6 -mt-6 max-w-4xl mx-auto w-full space-y-5">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="font-bold text-invictus">Pagamento</h3>
            <button onClick={updatePayment} className="text-xs text-invictus hover:underline">editar</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 uppercase">Contrato</p>
              <p className="font-bold text-invictus-deep text-sm sm:text-base tabular-nums truncate">{fmtBRL(p.contract_value)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 uppercase">Pago</p>
              <p className="font-bold text-emerald-600 text-sm sm:text-base tabular-nums truncate">{fmtBRL(p.paid_amount)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 uppercase">Método</p>
              <p className="font-bold text-invictus-deep capitalize text-sm sm:text-base truncate">{p.payment_method ?? "—"}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-invictus-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-invictus">{pct}% pago</span>
          </div>
        </div>

        <InstallationNotesCard
          projectId={params.id}
          initial={p.installation_notes ?? ""}
          onSaved={(v) => setP({ ...p, installation_notes: v })}
        />

        <ProjectDocuments projectId={params.id} />

        {p.current_phase >= 8 && p.current_phase <= 9 && (
          <InstallChecklist projectId={params.id} onChange={setChecklist} />
        )}

        {currentPhase && (
          <div className="bg-invictus-deep text-white rounded-2xl shadow-card p-5">
            <p className="text-[10px] font-semibold tracking-wider text-invictus-accent uppercase">
              Fase atual ({p.current_phase}/12)
            </p>
            <h2 className="text-2xl font-bold mt-1">{currentPhase.phase_name}</h2>
            {nextPhaseNumber <= 12 && (() => {
              const blockedByChecklist = p.current_phase === 9 && checklist !== null && !checklist.complete;
              return (
                <>
                  <button
                    onClick={() => complete(currentPhase)}
                    disabled={blockedByChecklist}
                    className={`w-full mt-4 py-3 font-bold rounded-xl transition ${
                      blockedByChecklist
                        ? "bg-white/20 text-white/50 cursor-not-allowed"
                        : "bg-invictus-accent text-invictus-deep hover:brightness-110"
                    }`}
                  >
                    ✓ Avançar para fase {nextPhaseNumber}
                  </button>
                  {blockedByChecklist && (
                    <p className="text-[11px] text-white/75 mt-2">
                      🔒 Envie todas as fotos do checklist acima para liberar a conclusão.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase mb-3">
            Todas as fases
          </p>
          <ul className="space-y-2.5">
            {p.phases.map((ph) => {
              const isCurrent = ph.phase_number === p.current_phase && ph.status !== "completed";
              const dotStatus = ph.status === "completed" ? "completed"
                : isCurrent ? "in_progress" : "pending";
              return (
                <li key={ph.id} className="bg-white rounded-2xl shadow-card p-4">
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 w-3 h-3 rounded-full ${dotColor(dotStatus)}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${
                        ph.status === "completed" ? "text-slate-800" :
                        isCurrent ? "text-invictus" : "text-slate-400"
                      }`}>
                        {ph.phase_number}. {ph.phase_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {ph.completed_date
                          ? `✓ Concluído em ${fmt(ph.completed_date)}`
                          : isCurrent && ph.scheduled_date
                            ? `• ATUAL — previsto para ${fmt(ph.scheduled_date)}`
                            : isCurrent
                              ? "• ATUAL — clique em Avançar acima"
                              : ph.scheduled_date
                                ? `Previsto para ${fmt(ph.scheduled_date)}`
                                : "Sem data — toque para agendar"}
                      </p>
                    </div>
                    {ph.status !== "completed" && (
                      <button
                        onClick={() => schedule(ph)}
                        className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg font-medium hover:bg-invictus hover:text-white transition"
                      >
                        {ph.scheduled_date ? "Remarcar" : "Agendar"}
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
