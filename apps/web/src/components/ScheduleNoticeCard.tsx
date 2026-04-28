"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

function fmtBR(iso: string) {
  // iso = YYYY-MM-DD
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function dateClause(iso: string) {
  return iso ? `Nova data: ${fmtBR(iso)}.` : "Entraremos em contato com a nova data assim que possível.";
}

const TEMPLATES = [
  {
    key: "rain",
    label: "Chuva / clima",
    text: (name: string, date: string) =>
      `Olá ${name}! Por causa das condições climáticas de hoje, precisaremos reagendar a instalação do seu sistema solar. ${dateClause(date)} Obrigado pela compreensão.`,
  },
  {
    key: "previous_job",
    label: "Obra anterior atrasou",
    text: (name: string, date: string) =>
      `Olá ${name}! A obra anterior à sua teve um imprevisto e precisou se estender. ${dateClause(date)} Obrigado pela paciência.`,
  },
  {
    key: "team_delay",
    label: "Equipe atrasada",
    text: (name: string, date: string) =>
      `Olá ${name}! Nossa equipe está com um pequeno atraso na agenda de hoje. ${dateClause(date)}`,
  },
  {
    key: "custom",
    label: "Mensagem personalizada",
    text: () => "",
  },
] as const;

export function ScheduleNoticeCard({
  projectId,
  clientName,
  currentScheduledDate,
}: {
  projectId: string;
  clientName: string;
  currentScheduledDate: string | null;
}) {
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["key"]>("rain");
  const firstName = useMemo(() => clientName.split(" ")[0] ?? "", [clientName]);
  const [message, setMessage] = useState<string>(TEMPLATES[0].text(firstName, ""));
  const [newDate, setNewDate] = useState<string>("");
  const [touched, setTouched] = useState(false); // marca se admin editou o texto manualmente
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  function applyTemplate(key: (typeof TEMPLATES)[number]["key"]) {
    setTemplate(key);
    setTouched(false);
    const t = TEMPLATES.find((x) => x.key === key);
    if (t) setMessage(t.text(firstName, newDate));
  }

  // Re-renderiza a mensagem quando a data muda (a menos que admin tenha editado manualmente).
  useEffect(() => {
    if (touched) return;
    if (template === "custom") return;
    const t = TEMPLATES.find((x) => x.key === template);
    if (t) setMessage(t.text(firstName, newDate));
  }, [newDate, template, firstName, touched]);

  async function send() {
    if (message.trim().length < 5) {
      toast.show({ message: "Escreva uma mensagem antes de enviar.", tone: "error", duration: 3000 });
      return;
    }
    setBusy(true);
    try {
      const r = await api.post<{
        whatsapp: boolean;
        whatsapp_error: string | null;
        push_sent: number;
        push_subscriptions: number;
      }>(`/projects/${projectId}/reschedule-notice`, {
        message: message.trim(),
        new_scheduled_date: newDate || null,
      });
      const parts: string[] = [];
      parts.push(r.whatsapp ? "✅ WhatsApp enviado" : "❌ WhatsApp falhou");
      parts.push(
        r.push_subscriptions === 0
          ? "ℹ️ Cliente sem push instalado"
          : `📱 Push: ${r.push_sent}/${r.push_subscriptions}`,
      );
      toast.show({ message: parts.join(" · "), tone: r.whatsapp ? "success" : "error", duration: 5000 });
      if (!r.whatsapp && r.whatsapp_error) {
        console.warn("WhatsApp error:", r.whatsapp_error);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        toast.show({ message: e.message, tone: "error", duration: 5000 });
      } else {
        toast.show({ message: "Falha ao enviar", tone: "error", duration: 4000 });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-invictus">Observação de agendamento</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Avise o cliente sobre atraso ou reagendamento. Envia WhatsApp + notificação no app.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">
            Modelo
          </label>
          <select
            value={template}
            onChange={(e) => applyTemplate(e.target.value as (typeof TEMPLATES)[number]["key"])}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-invictus text-sm"
          >
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">
            Mensagem
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => { setMessage(e.target.value); setTouched(true); }}
            placeholder="Texto que o cliente vai receber…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus resize-y text-sm"
          />
          <p className="text-[10px] text-slate-400 mt-1">{message.length}/1000</p>
        </div>

        <div>
          <label className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">
            Nova data de instalação (opcional)
          </label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus text-sm"
          />
          {currentScheduledDate && !newDate && (
            <p className="text-[10px] text-slate-500 mt-1">
              Atual: {new Date(currentScheduledDate + "T12:00:00").toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
          )}
        </div>

        <button
          onClick={send}
          disabled={busy}
          className="w-full py-2.5 bg-invictus text-white rounded-xl font-semibold hover:bg-invictus-dark transition disabled:opacity-60"
        >
          {busy ? "Enviando…" : "📩 Enviar aviso ao cliente"}
        </button>
      </div>
    </div>
  );
}
