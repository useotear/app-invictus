"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

export function InstallationNotesCard({
  projectId,
  initial,
  onSaved,
}: {
  projectId: string;
  initial: string;
  onSaved: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await api.patch(`/projects/${projectId}`, { installation_notes: value || null });
      onSaved(value);
      setEditing(false);
      toast.show({ message: "Necessidades da obra salvas.", tone: "success", duration: 2500 });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao salvar",
        tone: "error",
        duration: 5000,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-bold text-invictus">Necessidades da obra</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            🔒 Visível só para a equipe. O cliente não vê.
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => { setValue(initial); setEditing(true); }}
            className="text-xs text-invictus hover:underline shrink-0"
          >
            {initial ? "editar" : "adicionar"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            rows={4}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex: mourão para laje, guindaste 12m, andaime, apoio elétrico, etc."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus resize-y text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setValue(initial); setEditing(false); }}
              className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="text-xs px-4 py-1.5 bg-invictus text-white rounded font-semibold hover:bg-invictus-dark transition disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      ) : initial ? (
        <p className="text-sm text-slate-700 whitespace-pre-line">{initial}</p>
      ) : (
        <p className="text-sm text-slate-400 italic">
          Nenhuma necessidade registrada. Use pra anotar materiais extras ou apoio técnico que a obra exige.
        </p>
      )}
    </div>
  );
}
