"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Phase, TOTAL_PHASES } from "@/lib/phases";
import { ProjectDocuments } from "@/components/ProjectDocuments";
import { InstallationNotesCard } from "@/components/InstallationNotesCard";
import { ProjectTextCard } from "@/components/ProjectTextCard";
import { InstallChecklist, ChecklistState } from "@/components/InstallChecklist";
import { PhasePhotos } from "@/components/PhasePhotos";
import { ScheduleNoticeCard } from "@/components/ScheduleNoticeCard";
import { useDialog } from "@/components/DialogProvider";
import { useToast } from "@/components/ToastProvider";
import { canEditPhase, canEditProject, canSendRescheduleNotice, useMe } from "@/lib/useMe";

const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "financiamento", label: "Financiamento" },
  { value: "outro", label: "Outro" },
];


interface ProjectDetail {
  id: string;
  address: string | null;
  location_link: string | null;
  installation_notes: string | null;
  materials: string | null;
  system_size_kwp: number | null;
  contract_value: number | null;
  paid_amount: number | null;
  payment_method: string | null;
  down_payment: number | null;
  installments: number | null;
  current_phase: number;
  client: { name: string; phone: string; email: string | null; access_token: string };
  seller: { id: string; name: string } | null;
  phases: Phase[];
}

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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

interface Seller { id: string; name: string; email: string; role: string }

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const [p, setP] = useState<ProjectDetail | null>(null);
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const dialog = useDialog();
  const toast = useToast();
  const { me } = useMe();
  const canAdvanceCurrent = !!p && canEditPhase(me?.role, p.current_phase);
  const canNotice = canSendRescheduleNotice(me?.role);

  const reload = () => api.get<ProjectDetail>(`/projects/${params.id}`).then(setP);
  useEffect(() => { reload(); }, [params.id]);
  useEffect(() => {
    if (me?.role !== "admin") return;
    api.get<Seller[]>("/users/sellers").then(setSellers).catch(() => {});
  }, [me?.role]);

  async function payInstallment() {
    if (!p) return;
    const contract = p.contract_value ?? 0;
    const entry = p.down_payment ?? 0;
    const n = p.installments ?? 0;
    if (contract <= 0 || n <= 0) {
      await dialog.alert({
        title: "Configure o pagamento primeiro",
        message: "Preencha valor do contrato, entrada e número de parcelas no botão 'editar' do Pagamento.",
        tone: "error",
      });
      return;
    }
    const installmentValue = (contract - entry) / n;
    const newPaid = (p.paid_amount ?? 0) + installmentValue;
    const ok = await dialog.confirm({
      title: "Registrar 1 parcela paga",
      message:
        `Valor de cada parcela: R$ ${installmentValue.toFixed(2)}\n` +
        `Pago atual: R$ ${(p.paid_amount ?? 0).toFixed(2)}\n` +
        `Após registrar: R$ ${newPaid.toFixed(2)}`,
      confirmText: "Confirmar",
    });
    if (!ok) return;
    try {
      await api.patch(`/projects/${params.id}`, {
        paid_amount: Number(newPaid.toFixed(2)),
      });
      toast.show({ message: "Parcela registrada.", tone: "success", duration: 2500 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao salvar",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function payDownPayment() {
    if (!p) return;
    const entry = p.down_payment ?? 0;
    if (entry <= 0) {
      await dialog.alert({
        title: "Sem entrada cadastrada",
        message: "Defina o valor da entrada no 'editar' do Pagamento.",
        tone: "error",
      });
      return;
    }
    const newPaid = (p.paid_amount ?? 0) + entry;
    const ok = await dialog.confirm({
      title: "Registrar entrada paga",
      message:
        `Entrada: R$ ${entry.toFixed(2)}\n` +
        `Pago atual: R$ ${(p.paid_amount ?? 0).toFixed(2)}\n` +
        `Após registrar: R$ ${newPaid.toFixed(2)}`,
      confirmText: "Confirmar",
    });
    if (!ok) return;
    try {
      await api.patch(`/projects/${params.id}`, {
        paid_amount: Number(newPaid.toFixed(2)),
      });
      toast.show({ message: "Entrada registrada.", tone: "success", duration: 2500 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao salvar",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function editLocationLink() {
    if (!p) return;
    const link = await dialog.prompt({
      title: "Link da localização",
      message: "Cole o link do Google Maps, Waze ou similar. Deixe em branco pra remover.",
      type: "text",
      defaultValue: p.location_link ?? "",
      placeholder: "https://maps.google.com/...",
      confirmText: "Salvar",
    });
    if (link === null) return;
    try {
      await api.patch(`/projects/${params.id}`, { location_link: link || null });
      toast.show({ message: "Localização atualizada.", tone: "success", duration: 2500 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao salvar",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function changeSeller() {
    const options = [
      { value: "", label: "— sem vendedor —" },
      ...sellers.map((s) => ({ value: s.id, label: s.name })),
    ];
    const newId = await dialog.prompt({
      title: "Trocar vendedor",
      message: "Escolha o vendedor responsável por este projeto.",
      type: "select",
      options,
      defaultValue: p?.seller?.id ?? "",
      confirmText: "Salvar",
    });
    if (newId === null) return;
    try {
      await api.patch(`/projects/${params.id}`, { seller_id: newId || null });
      toast.show({ message: "Vendedor atualizado.", tone: "success", duration: 2500 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao trocar",
        tone: "error",
        duration: 4000,
      });
    }
  }

  function previewMessage(phase: Phase) {
    if (!p) return "";
    const firstName = p.client.name.split(" ")[0];
    return `Olá ${firstName}! Seu projeto avançou para a fase ${phase.phase_number}: ${phase.phase_name}. Acompanhe em tempo real no seu portal.`;
  }

  async function togglePhaseStatus(phase: Phase) {
    if (phase.status === "completed") {
      const ok = await dialog.confirm({
        title: `Desmarcar "${phase.phase_name}"?`,
        message: "A fase volta pra pendente. A data de conclusão é apagada.",
        confirmText: "Desmarcar",
        danger: true,
      });
      if (!ok) return;
      try {
        await api.patch(`/phases/${phase.id}`, { status: "pending", completed_date: null });
        toast.show({ message: "Fase reaberta.", tone: "success", duration: 2500 });
        reload();
      } catch (e) {
        toast.show({
          message: e instanceof Error ? e.message : "Erro ao desmarcar",
          tone: "error",
          duration: 5000,
        });
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const date = await dialog.prompt({
        title: `Marcar "${phase.phase_name}" como concluída`,
        message: "Em que dia foi concluída?",
        type: "date",
        defaultValue: today,
        confirmText: "Concluir",
      });
      if (date === null) return;
      try {
        await api.patch(`/phases/${phase.id}`, { status: "completed", completed_date: date || today });
        toast.show({ message: "Fase concluída.", tone: "success", duration: 2500 });
        reload();
      } catch (e) {
        toast.show({
          message: e instanceof Error ? e.message : "Erro ao concluir",
          tone: "error",
          duration: 5000,
        });
      }
    }
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

    // Persiste imediatamente. Sem delay de 5s — se o usuário atualizar a página
    // durante o delay, o PATCH não rodava e parecia que não salvou.
    try {
      await api.patch(`/phases/${phase.id}`, { status: "completed", completed_date: chosenDate });
      toast.show({ message: "Fase avançada. Cliente notificado.", tone: "success", duration: 3000 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Falha ao avançar fase",
        tone: "error",
        duration: 6000,
      });
    }
  }

  async function schedule(phase: Phase) {
    const isCompleted = phase.status === "completed";
    const d = await dialog.prompt({
      title: isCompleted ? `Editar data: ${phase.phase_name}` : `Agendar: ${phase.phase_name}`,
      message: isCompleted
        ? "Editar a data em que esta fase foi concluída."
        : "Escolha a data prevista. Deixe em branco para remover.",
      type: "date",
      defaultValue: (isCompleted ? phase.completed_date : phase.scheduled_date) ?? "",
      confirmText: "Salvar",
    });
    if (d === null) return;
    const payload = isCompleted
      ? { completed_date: d || null }
      : { scheduled_date: d || null };
    try {
      await api.patch(`/phases/${phase.id}`, payload);
      toast.show({
        message: d
          ? `${isCompleted ? "Conclusão" : "Agendamento"}: ${new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR")}`
          : `${isCompleted ? "Data de conclusão" : "Agendamento"} removido`,
        tone: "success",
        duration: 3000,
      });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao salvar",
        tone: "error",
        duration: 5000,
      });
    }
  }

  async function updatePayment() {
    if (!p) return;
    const contract = await dialog.prompt({
      title: "Valor do contrato (R$)",
      message: "Valor total do contrato.",
      type: "number",
      defaultValue: String(p.contract_value ?? 0),
      confirmText: "Próximo",
    });
    if (contract === null) return;
    const entry = await dialog.prompt({
      title: "Entrada (R$)",
      message: "Valor da entrada (à vista). Deixe 0 se não há entrada.",
      type: "number",
      defaultValue: String(p.down_payment ?? 0),
      confirmText: "Próximo",
    });
    if (entry === null) return;
    const installments = await dialog.prompt({
      title: "Parcelas",
      message: "Quantas parcelas pro restante? Use 1 pra à vista.",
      type: "number",
      defaultValue: String(p.installments ?? 1),
      confirmText: "Próximo",
    });
    if (installments === null) return;
    const method = await dialog.prompt({
      title: "Forma de pagamento das parcelas",
      type: "select",
      options: PAYMENT_METHODS,
      defaultValue: p.payment_method ?? "boleto",
      confirmText: "Próximo",
    });
    if (method === null) return;
    const paid = await dialog.prompt({
      title: "Valor já pago acumulado (R$)",
      message: "Quanto o cliente já pagou no total (entrada + parcelas pagas).",
      type: "number",
      defaultValue: String(p.paid_amount ?? 0),
      confirmText: "Salvar",
    });
    if (paid === null) return;
    try {
      await api.patch(`/projects/${params.id}`, {
        contract_value: Number(contract),
        down_payment: Number(entry) || null,
        installments: Number(installments) > 0 ? Number(installments) : null,
        payment_method: method,
        paid_amount: Number(paid),
      });
      toast.show({ message: "Pagamento atualizado.", tone: "success", duration: 3000 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao salvar",
        tone: "error",
        duration: 5000,
      });
    }
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
          {p.location_link ? (
            <span className="text-invictus-accent inline-flex items-center gap-1">
              <a href={p.location_link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                📍 Localização
              </a>
              {canEditProject(me?.role) && (
                <button onClick={editLocationLink} className="text-white/70 hover:text-white text-[11px]" title="Editar link">
                  ✏️
                </button>
              )}
            </span>
          ) : (
            canEditProject(me?.role) && (
              <button onClick={editLocationLink} className="text-invictus-accent hover:underline">
                📍 Adicionar link
              </button>
            )
          )}
          <span className="text-white/60">
            Vendedor: <b className="text-white/85">{p.seller?.name ?? "—"}</b>
            {me?.role === "admin" && (
              <button onClick={changeSeller} className="ml-2 text-invictus-accent hover:underline">
                trocar
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="px-6 -mt-6 max-w-4xl mx-auto w-full space-y-5">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
            <h3 className="font-bold text-invictus">Pagamento</h3>
            {canEditProject(me?.role) && (
              <div className="flex gap-2 text-xs">
                {(p.down_payment ?? 0) > 0 && (
                  <button onClick={payDownPayment} className="text-emerald-700 hover:underline">+ Entrada paga</button>
                )}
                {(p.installments ?? 0) > 0 && (
                  <button onClick={payInstallment} className="text-emerald-700 hover:underline">+ 1 parcela paga</button>
                )}
                <button onClick={updatePayment} className="text-invictus hover:underline">editar</button>
              </div>
            )}
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
          {(p.down_payment || p.installments) && (
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 border-t border-slate-100 pt-3">
              {p.down_payment ? (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Entrada</p>
                  <p className="font-bold text-invictus-deep tabular-nums">{fmtBRL(p.down_payment)}</p>
                </div>
              ) : null}
              {p.installments && p.installments > 0 ? (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Parcelas</p>
                  <p className="font-bold text-invictus-deep">
                    {p.installments}x{" "}
                    {p.contract_value && p.contract_value > 0 && (
                      <span className="text-slate-500 font-normal text-[11px]">
                        ({fmtBRL(((p.contract_value ?? 0) - (p.down_payment ?? 0)) / p.installments)} cada)
                      </span>
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-invictus-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-semibold text-invictus">{pct}% pago</span>
          </div>
        </div>

        <ProjectTextCard
          projectId={params.id}
          field="materials"
          title="Materiais do kit"
          hint="Itens que compõem o kit (módulos, inversor, micro etc)."
          placeholder="Ex: 40 módulos 550W Canadian, Inversor GoodWe 4 MPPT 8kW"
          emptyText="Nenhum material descrito ainda."
          initial={p.materials ?? ""}
          onSaved={(v) => setP({ ...p, materials: v })}
        />

        <InstallationNotesCard
          projectId={params.id}
          initial={p.installation_notes ?? ""}
          onSaved={(v) => setP({ ...p, installation_notes: v })}
        />

        <ProjectDocuments projectId={params.id} />

        {p.current_phase >= 6 && p.current_phase <= 10 && (
          <InstallChecklist projectId={params.id} onChange={setChecklist} />
        )}

        {p.current_phase >= 14 && (
          <PhasePhotos
            projectId={params.id}
            phaseNumber={14}
            title="Fotos da manutenção"
            hint="Anexe fotos da visita de manutenção (estado dos painéis, inversor, fiação, etc)."
            category="other"
          />
        )}

        {canNotice && (
          <ScheduleNoticeCard
            projectId={params.id}
            clientName={p.client.name}
            currentScheduledDate={p.phases.find((ph) => ph.phase_number === 6)?.scheduled_date ?? null}
          />
        )}

        {currentPhase && (
          <div className="bg-invictus-deep text-white rounded-2xl shadow-card p-5">
            <p className="text-[10px] font-semibold tracking-wider text-invictus-accent uppercase">
              Fase atual ({p.current_phase}/{TOTAL_PHASES})
            </p>
            <h2 className="text-2xl font-bold mt-1">{currentPhase.phase_name}</h2>
            {nextPhaseNumber <= TOTAL_PHASES && canAdvanceCurrent && (() => {
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
            {nextPhaseNumber <= TOTAL_PHASES && !canAdvanceCurrent && me && (
              <p className="text-[11px] text-white/70 mt-3">
                🔒 Seu perfil ({me.role}) não pode avançar esta fase.
              </p>
            )}
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
                    {canEditPhase(me?.role, ph.phase_number) && (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => schedule(ph)}
                          className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg font-medium hover:bg-invictus hover:text-white transition"
                        >
                          {ph.status === "completed" ? "Editar data" : ph.scheduled_date ? "Remarcar" : "Agendar"}
                        </button>
                        <button
                          onClick={() => togglePhaseStatus(ph)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition border ${
                            ph.status === "completed"
                              ? "border-red-400 text-red-600 hover:bg-red-500 hover:text-white"
                              : "border-emerald-500 text-emerald-700 hover:bg-emerald-500 hover:text-white"
                          }`}
                          title={ph.status === "completed" ? "Reabrir fase" : "Marcar como concluída"}
                        >
                          {ph.status === "completed" ? "↺ Reabrir" : "✓ Concluir"}
                        </button>
                      </div>
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
