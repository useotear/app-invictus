"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useDialog } from "@/components/DialogProvider";

export const REQUIRED_CATEGORIES = ["grid_entry", "inverter", "seal", "panels"] as const;
export type Category = typeof REQUIRED_CATEGORIES[number];

const LABELS: Record<Category, { title: string; hint: string }> = {
  grid_entry: {
    title: "Entrada de rede + plaquinha Invictus",
    hint: "Foto da entrada de rede com a advertência e a plaquinha da Invictus visíveis.",
  },
  inverter: {
    title: "Inversor e micro",
    hint: "Fotos do inversor instalado e do(s) micro inversor(es).",
  },
  seal: {
    title: "Selos do micro e inversor",
    hint: "Close-up dos selos/etiquetas de identificação.",
  },
  panels: {
    title: "Painéis solares",
    hint: "Fotos dos painéis instalados no telhado.",
  },
};

interface Photo {
  id: string;
  category: string | null;
  phase_number: number | null;
  photo_url: string;
  created_at: string;
}

export interface ChecklistState {
  counts: Record<Category, number>;
  missing: Category[];
  complete: boolean;
}

export function InstallChecklist({
  projectId,
  onChange,
}: {
  projectId: string;
  onChange?: (state: ChecklistState) => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [uploading, setUploading] = useState<Category | null>(null);
  const toast = useToast();
  const dialog = useDialog();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const r = await fetch(`${API_URL}/projects/${projectId}/photos`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
      cache: "no-store",
    });
    if (r.ok) setPhotos(await r.json());
  }

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    if (!photos || !onChange) return;
    const counts = REQUIRED_CATEGORIES.reduce((acc, c) => {
      acc[c] = photos.filter((p) => p.phase_number === 9 && p.category === c).length;
      return acc;
    }, {} as Record<Category, number>);
    const missing = REQUIRED_CATEGORIES.filter((c) => counts[c] === 0);
    onChange({ counts, missing, complete: missing.length === 0 });
  }, [photos, onChange]);

  async function upload(category: Category, file: File) {
    setUploading(category);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      fd.append("phase_number", "9");
      const r = await fetch(`${API_URL}/projects/${projectId}/photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: fd,
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`${r.status} ${txt || r.statusText}`);
      }
      toast.show({ message: "Foto enviada.", tone: "success", duration: 2500 });
      await load();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao enviar",
        tone: "error",
        duration: 5000,
      });
    } finally {
      setUploading(null);
    }
  }

  async function remove(photoId: string) {
    const ok = await dialog.confirm({
      title: "Remover foto?",
      message: "A foto será apagada definitivamente.",
      confirmText: "Remover",
      danger: true,
    });
    if (!ok) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`${API_URL}/projects/${projectId}/photos/${photoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      toast.show({ message: "Foto removida.", tone: "success", duration: 2000 });
      await load();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function openSigned(photoId: string) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`${API_URL}/projects/${projectId}/photos/${photoId}/signed-url`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const { url } = await r.json();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.show({ message: "Erro ao abrir a foto", tone: "error", duration: 4000 });
    }
  }

  if (photos === null) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-5">
        <p className="text-sm text-slate-500">Carregando checklist…</p>
      </div>
    );
  }

  const byCategory = REQUIRED_CATEGORIES.reduce((acc, c) => {
    acc[c] = photos.filter((p) => p.phase_number === 9 && p.category === c);
    return acc;
  }, {} as Record<Category, Photo[]>);
  const missingCount = REQUIRED_CATEGORIES.filter((c) => byCategory[c].length === 0).length;
  const complete = missingCount === 0;

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-invictus">Checklist de fotos da instalação</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Obrigatório antes de marcar a fase 9 como concluída.
          </p>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full ${
            complete
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {complete ? "✓ Completo" : `Faltam ${missingCount}`}
        </span>
      </div>

      <ul className="space-y-3">
        {REQUIRED_CATEGORIES.map((cat) => {
          const items = byCategory[cat];
          const has = items.length > 0;
          return (
            <li key={cat} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-invictus-deep flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${has ? "bg-emerald-500" : "bg-slate-300"}`} />
                    {LABELS[cat].title}
                    {items.length > 0 && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{LABELS[cat].hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => inputRefs.current[cat]?.click()}
                  disabled={uploading === cat}
                  className="shrink-0 text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg font-medium hover:bg-invictus hover:text-white transition disabled:opacity-60"
                >
                  {uploading === cat ? "Enviando…" : "+ Foto"}
                </button>
                <input
                  ref={(el) => { inputRefs.current[cat] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(cat, f);
                    e.target.value = "";
                  }}
                />
              </div>

              {items.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {items.map((ph) => (
                    <li key={ph.id} className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1">
                      <button
                        onClick={() => openSigned(ph.id)}
                        className="text-[11px] text-invictus hover:underline truncate max-w-[180px]"
                      >
                        🖼️ {ph.photo_url.split("/").pop()}
                      </button>
                      <button
                        onClick={() => remove(ph.id)}
                        className="text-[11px] text-slate-400 hover:text-red-600"
                        title="Remover"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
