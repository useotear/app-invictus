"use client";

import { Phase } from "@/lib/phases";

function dotClasses(status: Phase["status"]) {
  if (status === "completed") return "bg-emerald-500 border-emerald-500";
  if (status === "in_progress") return "bg-invictus-accent border-invictus-accent ring-4 ring-invictus-accent/30 animate-pulse";
  return "bg-white border-slate-300";
}

function fmt(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function Timeline({ phases }: { phases: Phase[] }) {
  return (
    <ol className="relative border-l-2 border-slate-200 ml-3 space-y-5">
      {phases.map((p) => {
        const isCurrent = p.status === "in_progress";
        return (
          <li key={p.id} className="pl-6 relative">
            <span className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-2 ${dotClasses(p.status)}`} />
            {isCurrent && (
              <span className="text-[10px] font-semibold tracking-wider text-invictus-accent uppercase">
                Etapa atual
              </span>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={`font-semibold text-sm ${
                p.status === "completed" ? "text-slate-800" :
                isCurrent ? "text-invictus" : "text-slate-400"
              }`}>
                {p.phase_number}. {p.phase_name}
              </h3>
              <span className="text-[11px] text-slate-500 shrink-0">
                {p.completed_date ? `✓ ${fmt(p.completed_date)}` : p.scheduled_date ? `prev. ${fmt(p.scheduled_date)}` : ""}
              </span>
            </div>
            {p.notes && <p className="text-xs text-slate-500 mt-1">{p.notes}</p>}
          </li>
        );
      })}
    </ol>
  );
}
