"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

/** Card genérico de campo livre de texto num projeto (instalação_notes, materials, etc). */
export function ProjectTextCard({
  projectId,
  field,
  title,
  hint,
  placeholder,
  emptyText,
  initial,
  onSaved,
}: {
  projectId: string;
  field: string;        // nome da coluna em projects
  title: string;
  hint?: string;
  placeholder?: string;
  emptyText?: string;
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
      await api.patch(`/projects/${projectId}`, { [field]: value || null });
      onSaved(value);
      setEditing(false);
      toast.show({ message: "Salvo.", tone: "success", duration: 2000 });
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
          <h3 className="font-bold text-invictus">{title}</h3>
          {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
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
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
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
          {emptyText ?? "Sem informação ainda."}
        </p>
      )}
    </div>
  );
}
