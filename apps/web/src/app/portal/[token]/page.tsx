import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalRealtime } from "./realtime";
import { API_URL } from "@/lib/supabase";
import { Phase } from "@/lib/phases";

interface Project {
  id: string;
  address: string | null;
  system_size_kwp: number | null;
  current_phase: number;
  phases: Phase[];
}
interface Resp {
  client: { id: string; name: string; email: string | null; phone: string };
  projects: Project[];
}

async function load(token: string): Promise<Resp | null> {
  try {
    const r = await fetch(`${API_URL}/projects/by-client-token/${token}`, { cache: "no-store" });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function projectType(size: number | null) {
  if (!size) return "Seu projeto";
  return size < 10 ? "Residencial" : "Comercial";
}

export default async function Portal({ params }: { params: { token: string } }) {
  const data = await load(params.token);
  if (!data) notFound();
  const { client, projects } = data;
  const primary = projects[0];
  const pct = primary ? Math.round((primary.current_phase / 12) * 100) : 0;

  return (
    <main className="min-h-screen bg-invictus-bg">
      <header className="bg-invictus text-white px-6 pt-10 pb-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-invictus-accent uppercase">Invictus Solar</p>
        <h1 className="text-2xl font-bold mt-1">Olá, {client.name.split(" ")[0]}</h1>
        {primary && (
          <>
            <p className="text-sm text-white/80 mt-1">
              Seu sistema está na fase {primary.current_phase} de 12
            </p>
            <div className="mt-4">
              <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full bg-invictus-accent rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-invictus-accent font-medium mt-2">{pct}% concluído</p>
            </div>
          </>
        )}
      </header>

      <PortalRealtime token={params.token} />

      <div className="p-4 max-w-xl mx-auto space-y-4 -mt-4">
        {projects.length === 0 && (
          <p className="text-slate-600 text-center py-12">Nenhum projeto ainda.</p>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/portal/${params.token}/${p.id}`}
            className="block bg-white rounded-2xl shadow-card p-5 hover:shadow-lg transition"
          >
            <h2 className="font-bold text-invictus text-lg">
              {projectType(p.system_size_kwp)}{p.system_size_kwp ? ` — ${p.system_size_kwp} kWp` : ""}
            </h2>
            {p.address && <p className="text-sm text-slate-500 mt-0.5">{p.address}</p>}
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">Fase {p.current_phase}/12</span>
              <span className="text-invictus font-semibold">Ver detalhes →</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
