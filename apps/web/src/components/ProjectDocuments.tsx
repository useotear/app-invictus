"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { API_URL, supabase } from "@/lib/supabase";
import { useDialog } from "./DialogProvider";

interface Doc {
  id: string;
  name: string;
  file_url: string;
  created_at: string;
}

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialog = useDialog();

  const reload = useCallback(() => {
    api.get<Doc[]>(`/projects/${projectId}/documents`).then(setDocs).catch(() => {});
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  async function upload(file: File, label?: string) {
    setUploading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const fd = new FormData();
      fd.append("file", file);
      if (label) fd.append("label", label);
      const r = await fetch(`${API_URL}/projects/${projectId}/documents`, {
        method: "POST",
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(await r.text());
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function openDoc(docId: string) {
    try {
      const { url } = await api.get<{ url: string }>(`/projects/${projectId}/documents/${docId}/signed-url`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Erro ao abrir",
        tone: "error",
      });
    }
  }

  async function remove(docId: string, name: string) {
    const ok = await dialog.confirm({
      title: "Remover documento",
      message: `"${name}" será removido permanentemente.`,
      confirmText: "Remover",
      danger: true,
    });
    if (!ok) return;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const r = await fetch(`${API_URL}/projects/${projectId}/documents/${docId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(await r.text());
      reload();
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Erro ao remover",
        tone: "error",
      });
    }
  }

  async function pickFile() {
    inputRef.current?.click();
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const label = await dialog.prompt({
      title: "Nome do documento",
      message: "Ex: Contrato assinado, Comprovante de pagamento",
      placeholder: f.name,
      defaultValue: f.name,
      confirmText: "Enviar",
    });
    if (label === null) return;
    upload(f, label);
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-invictus">Documentos</h3>
        <button
          onClick={pickFile}
          disabled={uploading}
          className="text-xs px-3 py-1.5 bg-invictus text-white rounded-lg hover:bg-invictus-dark transition disabled:opacity-50"
        >
          {uploading ? "Enviando…" : "+ Anexar arquivo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          onChange={onFilePicked}
        />
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {docs.length === 0 ? (
        <p className="text-xs text-slate-500">
          Nenhum documento. Anexe contrato, comprovantes de pagamento, parecer da Celesc, fotos da instalação.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {docs.map((d) => (
            <li key={d.id} className="py-2 flex items-center gap-3">
              <button
                onClick={() => openDoc(d.id)}
                className="flex-1 text-left text-sm text-invictus font-medium hover:underline truncate"
              >
                📎 {d.name}
              </button>
              <span className="text-[10px] text-slate-400">
                {new Date(d.created_at).toLocaleDateString("pt-BR")}
              </span>
              <button onClick={() => remove(d.id, d.name)} className="text-xs text-red-500 hover:text-red-700">
                remover
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
