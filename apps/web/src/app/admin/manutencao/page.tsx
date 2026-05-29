"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface Maintenance {
  id: string;
  client_id: string;
  scheduled_date: string;
  status: "scheduled" | "completed" | "canceled";
  notes: string | null;
  completed_date: string | null;
  client: Client;
}

const STATUS_LABEL: Record<Maintenance["status"], string> = {
  scheduled: "Agendada",
  completed: "Concluída",
  canceled: "Cancelada",
};

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MaintenancePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Maintenance[]>([]);
  const [clientId, setClientId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const reload = async () => {
    const [clientRows, maintenanceRows] = await Promise.all([
      api.get<Client[]>("/clients"),
      api.get<Maintenance[]>("/maintenance"),
    ]);
    setClients(clientRows);
    setItems(maintenanceRows);
  };

  useEffect(() => {
    reload().catch((e) => {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao carregar manutenções",
        tone: "error",
        duration: 5000,
      });
    });
  }, []);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 12);
    return clients
      .filter((c) => `${c.name} ${c.phone} ${c.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [clients, query]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const upcoming = items.filter((i) => i.status === "scheduled");
  const history = items.filter((i) => i.status !== "scheduled");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !scheduledDate) return;
    setBusy(true);
    try {
      await api.post("/maintenance", {
        client_id: clientId,
        scheduled_date: scheduledDate,
        notes: notes || null,
      });
      toast.show({ message: "Manutenção agendada.", tone: "success", duration: 2500 });
      setScheduledDate("");
      setNotes("");
      await reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao agendar manutenção",
        tone: "error",
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  async function patchItem(id: string, body: Record<string, string | null>) {
    try {
      await api.patch(`/maintenance/${id}`, body);
      await reload();
      toast.show({ message: "Manutenção atualizada.", tone: "success", duration: 2500 });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao atualizar",
        tone: "error",
        duration: 5000,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-invictus uppercase">Manutenção</p>
        <h1 className="text-3xl font-bold text-invictus-deep">Agendar manutenção</h1>
        <p className="text-sm text-slate-500 mt-1">
          Use para cliente antigo: selecione o cliente e informe a data da próxima manutenção.
        </p>
      </div>

      <section className="bg-white rounded-2xl shadow-card p-5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-invictus-deep">Buscar cliente</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, telefone ou email"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
            />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredClients.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setClientId(c.id)}
                  className={`text-left border rounded-lg px-3 py-2 transition ${
                    clientId === c.id
                      ? "border-invictus bg-invictus/5"
                      : "border-slate-200 hover:border-invictus/50"
                  }`}
                >
                  <p className="font-semibold text-sm text-invictus-deep truncate">{c.name}</p>
                  <p className="text-xs text-slate-500 truncate">{c.phone}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedClient && (
            <div className="rounded-lg bg-invictus-bg px-3 py-2 text-sm text-invictus-deep">
              Cliente selecionado: <b>{selectedClient.name}</b>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-invictus-deep">Data da próxima manutenção</span>
              <input
                required
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-invictus-deep">Observação</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: limpeza dos módulos, revisão do inversor"
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
              />
            </label>
          </div>

          <button
            disabled={busy || !clientId || !scheduledDate}
            className="w-full bg-invictus text-white py-3 rounded-xl font-semibold hover:bg-invictus-dark transition disabled:opacity-50"
          >
            {busy ? "Agendando..." : "Agendar manutenção"}
          </button>
        </form>
      </section>

      <MaintenanceList title="Próximas manutenções" items={upcoming} onPatch={patchItem} />
      <MaintenanceList title="Histórico" items={history} onPatch={patchItem} />
    </div>
  );
}

function MaintenanceList({
  title,
  items,
  onPatch,
}: {
  title: string;
  items: Maintenance[];
  onPatch: (id: string, body: Record<string, string | null>) => void;
}) {
  return (
    <section>
      <h2 className="font-bold text-lg mb-3">{title}</h2>
      <div className="space-y-3">
        {items.map((m) => (
          <article key={m.id} className="bg-white rounded-2xl shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-invictus-deep truncate">{m.client.name}</p>
                <p className="text-xs text-slate-500">{m.client.phone}</p>
                {m.notes && <p className="text-sm text-slate-600 mt-2">{m.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{STATUS_LABEL[m.status]}</p>
                <p className="text-lg font-bold text-invictus">{fmtDate(m.scheduled_date)}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <input
                type="date"
                defaultValue={m.scheduled_date}
                onBlur={(e) => {
                  if (e.target.value && e.target.value !== m.scheduled_date) {
                    onPatch(m.id, { scheduled_date: e.target.value });
                  }
                }}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs"
              />
              {m.status !== "completed" && (
                <button
                  onClick={() => onPatch(m.id, {
                    status: "completed",
                    completed_date: new Date().toISOString().slice(0, 10),
                  })}
                  className="text-xs px-3 py-1.5 border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-600 hover:text-white transition"
                >
                  Concluir
                </button>
              )}
              {m.status !== "canceled" && (
                <button
                  onClick={() => onPatch(m.id, { status: "canceled" })}
                  className="text-xs px-3 py-1.5 border border-red-500 text-red-600 rounded-lg hover:bg-red-500 hover:text-white transition"
                >
                  Cancelar
                </button>
              )}
              {m.status !== "scheduled" && (
                <button
                  onClick={() => onPatch(m.id, { status: "scheduled", completed_date: null })}
                  className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg hover:bg-invictus hover:text-white transition"
                >
                  Reagendar
                </button>
              )}
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-6 bg-white rounded-2xl shadow-card">
            Nenhum registro.
          </p>
        )}
      </div>
    </section>
  );
}
