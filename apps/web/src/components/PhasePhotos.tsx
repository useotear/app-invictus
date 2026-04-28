"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useDialog } from "@/components/DialogProvider";
import { canUploadInstallPhoto, useMe } from "@/lib/useMe";

interface Photo {
  id: string;
  category: string | null;
  phase_number: number | null;
  photo_url: string;
  created_at: string;
}

export function PhasePhotos({
  projectId,
  phaseNumber,
  title,
  hint,
  category = "other",
}: {
  projectId: string;
  phaseNumber: number;
  title: string;
  hint?: string;
  category?: string;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const dialog = useDialog();
  const { me } = useMe();
  const mayWrite = canUploadInstallPhoto(me?.role);

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

  const items = (photos ?? []).filter(
    (p) => p.phase_number === phaseNumber,
  );

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      fd.append("phase_number", String(phaseNumber));
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
      setUploading(false);
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

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-bold text-invictus">{title}</h3>
          {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {mayWrite && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg font-medium hover:bg-invictus hover:text-white transition disabled:opacity-60"
          >
            {uploading ? "Enviando…" : "+ Foto"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>

      {photos === null ? (
        <p className="text-xs text-slate-500">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">Nenhuma foto enviada ainda.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((ph) => (
            <li key={ph.id} className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1">
              <button
                onClick={() => openSigned(ph.id)}
                className="text-[11px] text-invictus hover:underline truncate max-w-[200px]"
              >
                🖼️ {ph.photo_url.split("/").pop()}
              </button>
              {mayWrite && (
                <button
                  onClick={() => remove(ph.id)}
                  className="text-[11px] text-slate-400 hover:text-red-600"
                  title="Remover"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
