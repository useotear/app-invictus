"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useDialog } from "@/components/DialogProvider";
import { useToast } from "@/components/ToastProvider";
import { useMe } from "@/lib/useMe";

interface QueueItem {
  position: number;
  project_id: string;
  client: { id: string; name: string; phone: string };
  address: string | null;
  location_link: string | null;
  installation_notes: string | null;
  system_size_kwp: number | null;
  current_phase: number;
  kit_arrival_date: string;
  install_scheduled_date: string | null;
  install_status: "pending" | "in_progress" | "completed";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function projectType(kwp: number | null) {
  if (!kwp) return "Projeto";
  return kwp < 10 ? "Residencial" : "Comercial";
}

export default function CronogramaPage() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const dialog = useDialog();
  const toast = useToast();
  const { isAdmin } = useMe();

  const reload = () =>
    api.get<QueueItem[]>("/schedule/installations")
      .then((q) => { setQueue(q); setErr(null); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro ao carregar"));

  useEffect(() => { reload(); }, []);

  async function move(item: QueueItem, direction: "up" | "down") {
    try {
      const r = await api.post<{ moved: boolean; reason?: string }>(
        `/schedule/installations/${item.project_id}/move-${direction}`, {},
      );
      if (!r.moved && r.reason) {
        toast.show({ message: r.reason, tone: "info", duration: 2500 });
      }
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao reordenar",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function markInstalled(item: QueueItem) {
    const today = new Date().toISOString().slice(0, 10);
    const date = await dialog.prompt({
      title: "Marcar instalação concluída",
      message: `Cliente: ${item.client.name}\n\nEm que dia a instalação foi concluída? (padrão: hoje)`,
      type: "date",
      defaultValue: today,
      confirmText: "Confirmar",
    });
    if (date === null) return;
    const chosen = date || today;

    // Buscar a fase 9 do projeto e atualizar
    try {
      const project = await api.get<{ phases: { id: string; phase_number: number }[] }>(
        `/projects/${item.project_id}`,
      );
      const installPhase = project.phases.find((p) => p.phase_number === 10);
      if (!installPhase) {
        toast.show({ message: "Fase de instalação não encontrada.", tone: "error" });
        return;
      }
      await api.patch(`/phases/${installPhase.id}`, {
        status: "completed",
        completed_date: chosen,
      });
      toast.show({
        message: `Instalação de ${item.client.name} concluída.`,
        tone: "success",
        duration: 3000,
      });
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        await dialog.alert({
          title: "Conclusão bloqueada",
          message: e.message || "Não foi possível concluir agora.",
          tone: "error",
        });
        return;
      }
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao marcar",
        tone: "error",
        duration: 5000,
      });
    }
  }

  if (err) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h1 className="text-lg font-bold text-invictus-deep">Cronograma de instalação</h1>
        <p className="text-sm text-red-600 mt-2">{err}</p>
      </div>
    );
  }

  if (queue === null) {
    return <p className="text-slate-500 text-sm">Carregando…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-invictus-deep">Cronograma de instalação</h1>
        <p className="text-xs text-slate-500 mt-1">
          Ordem FIFO: primeiro kit que chegou, primeiro a instalar. A equipe só pode marcar como
          concluído o <b>#1</b> da lista — o próximo sobe automaticamente.
          {isAdmin && " O admin pode reordenar manualmente com as setas ▲▼ ao lado da posição."}
        </p>
      </div>

      {queue.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-6 text-center">
          <p className="text-slate-500 text-sm">
            Nenhuma instalação pendente. Todos os projetos com kit entregue já foram concluídos.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {queue.map((item) => {
            const isNext = item.position === 1;
            return (
              <li
                key={item.project_id}
                className={`bg-white rounded-2xl shadow-card p-5 border-l-4 ${
                  isNext ? "border-invictus-accent" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            isNext
                              ? "bg-invictus-accent text-invictus-deep"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.position}
                        </span>
                        {isAdmin && queue && queue.length > 1 && (
                          <div className="flex flex-col -gap-px">
                            <button
                              onClick={() => move(item, "up")}
                              disabled={item.position === 1}
                              className="text-[10px] leading-none text-slate-400 hover:text-invictus disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Subir na fila"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => move(item, "down")}
                              disabled={item.position === queue.length}
                              className="text-[10px] leading-none text-slate-400 hover:text-invictus disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Descer na fila"
                            >
                              ▼
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-invictus-deep truncate">{item.client.name}</p>
                        <p className="text-xs text-slate-500">
                          {projectType(item.system_size_kwp)} — {item.system_size_kwp ?? "—"} kWp
                        </p>
                      </div>
                    </div>
                    {item.address && (
                      <p className="text-xs text-slate-600 mt-2">📍 {item.address}</p>
                    )}
                    {item.installation_notes && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-semibold tracking-wider text-amber-800 uppercase">
                          Necessidades da obra
                        </p>
                        <p className="text-xs text-amber-900 whitespace-pre-line mt-0.5">
                          {item.installation_notes}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                      <span>Kit entregue: <b>{fmtDate(item.kit_arrival_date)}</b></span>
                      <span>
                        Instalação: <b>{item.install_scheduled_date ? fmtDate(item.install_scheduled_date) : "sem agenda"}</b>
                      </span>
                      <a href={`tel:${item.client.phone}`} className="text-invictus hover:underline">
                        📞 {item.client.phone}
                      </a>
                      {item.location_link && (
                        <a
                          href={item.location_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-invictus hover:underline"
                        >
                          🗺️ Localização
                        </a>
                      )}
                      <Link
                        href={`/admin/projects/${item.project_id}`}
                        className="text-invictus hover:underline"
                      >
                        Ver projeto →
                      </Link>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isNext ? (
                      <button
                        onClick={() => markInstalled(item)}
                        className="px-4 py-2 bg-invictus text-white rounded-xl font-semibold hover:bg-invictus-dark transition text-sm"
                      >
                        ✓ Marcar instalada
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">
                        aguardando #{item.position - 1}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
