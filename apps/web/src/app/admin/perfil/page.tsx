"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMe, clearMeCache } from "@/lib/useMe";
import { useToast } from "@/components/ToastProvider";

type Role = "admin" | "seller" | "homologation" | "installer" | "scheduler";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  seller: "Vendedor",
  homologation: "Homologação",
  installer: "Instalação",
  scheduler: "Agendador",
};

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  is_install_manager: boolean;
}

export default function PerfilPage() {
  const { me, isAdmin } = useMe();
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (me) setPhone(me.phone ?? "");
  }, [me]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get<TeamMember[]>("/users/team").then(setTeam).catch(() => setTeam([]));
  }, [isAdmin]);

  async function savePhone() {
    setSavingPhone(true);
    try {
      await api.patch("/users/me", { phone });
      clearMeCache();
      toast.show({ message: "Telefone atualizado.", tone: "success", duration: 2500 });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro",
        tone: "error",
        duration: 4000,
      });
    } finally {
      setSavingPhone(false);
    }
  }

  async function toggleManager(member: TeamMember, flag: boolean) {
    try {
      await api.patch(`/users/${member.id}`, { is_install_manager: flag });
      setTeam((t) => t?.map((m) => (m.id === member.id ? { ...m, is_install_manager: flag } : m)) ?? null);
      toast.show({
        message: flag
          ? `${member.name} receberá alertas de instalação.`
          : `${member.name} removido dos alertas.`,
        tone: "success",
        duration: 2500,
      });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function setRole(member: TeamMember, role: Role) {
    try {
      await api.patch(`/users/${member.id}`, { role });
      setTeam((t) => t?.map((m) => (m.id === member.id ? { ...m, role } : m)) ?? null);
      toast.show({ message: `Perfil atualizado: ${ROLE_LABELS[role]}`, tone: "success", duration: 2500 });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro",
        tone: "error",
        duration: 4000,
      });
    }
  }

  async function saveMemberPhone(member: TeamMember, newPhone: string) {
    try {
      await api.patch(`/users/${member.id}`, { phone: newPhone });
      setTeam((t) => t?.map((m) => (m.id === member.id ? { ...m, phone: newPhone || null } : m)) ?? null);
      toast.show({ message: "Telefone atualizado.", tone: "success", duration: 2000 });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro",
        tone: "error",
        duration: 4000,
      });
    }
  }

  if (!me) return <p className="text-slate-500 text-sm">Carregando…</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
        <h1 className="text-lg font-bold text-invictus-deep">Meu perfil</h1>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          {me.email} — {me.role === "admin" ? "Admin" : "Vendedor"}
        </p>
        <div>
          <label className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-1">
            Telefone (WhatsApp)
          </label>
          <p className="text-[11px] text-slate-400 mb-2">
            Só dígitos, com DDD e DDI. Ex: 5548999999999. Usado pra receber notificações sobre seus clientes.
          </p>
          <div className="flex gap-2">
            <input
              inputMode="numeric"
              placeholder="5548999999999"
              pattern="\d{10,13}"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
            />
            <button
              onClick={savePhone}
              disabled={savingPhone}
              className="px-4 py-2 bg-invictus text-white rounded-lg font-semibold hover:bg-invictus-dark transition disabled:opacity-60"
            >
              Salvar
            </button>
          </div>
          {me.is_install_manager && (
            <p className="text-xs text-emerald-700 mt-2">
              ✓ Você recebe o aviso diário das instalações de amanhã.
            </p>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase mb-2">
              Notificações push
            </p>
            <button
              onClick={async () => {
                try {
                  const r = await api.post<{ ok: boolean; sent: number; subscriptions: number; reason?: string }>(
                    "/push/test", { title: "Teste", body: "Push do painel funcionando!", url: "/admin" },
                  );
                  if (!r.ok && r.reason) {
                    toast.show({ message: r.reason, tone: "error", duration: 6000 });
                  } else {
                    toast.show({
                      message: `Push enviado (${r.sent}/${r.subscriptions} dispositivos).`,
                      tone: r.ok ? "success" : "error",
                      duration: 4000,
                    });
                  }
                } catch (e) {
                  toast.show({
                    message: e instanceof Error ? e.message : "Erro",
                    tone: "error",
                    duration: 5000,
                  });
                }
              }}
              className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded-lg hover:bg-invictus hover:text-white transition"
            >
              📲 Enviar push de teste pra mim
            </button>
            <p className="text-[11px] text-slate-400 mt-2">
              Aceite notificações no browser primeiro. No PWA, assine só uma vez.
            </p>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
          <h2 className="font-bold text-invictus-deep">Equipe</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Marque quem recebe o aviso diário de instalações de amanhã (ex: Jesus/responsável pela instalação).
            Você também pode corrigir os telefones aqui.
          </p>
          {team === null ? (
            <p className="text-sm text-slate-500">Carregando equipe…</p>
          ) : team.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum membro cadastrado.</p>
          ) : (
            <ul className="space-y-3">
              {team.map((m) => (
                <TeamRow
                  key={m.id}
                  member={m}
                  onToggle={(flag) => toggleManager(m, flag)}
                  onSavePhone={(p) => saveMemberPhone(m, p)}
                  onSetRole={(r) => setRole(m, r)}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function TeamRow({
  member,
  onToggle,
  onSavePhone,
  onSetRole,
}: {
  member: TeamMember;
  onToggle: (flag: boolean) => void;
  onSavePhone: (phone: string) => void;
  onSetRole: (role: Role) => void;
}) {
  const [phone, setPhone] = useState(member.phone ?? "");
  const dirty = phone !== (member.phone ?? "");
  return (
    <li className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-invictus-deep truncate">{member.name}</p>
          <p className="text-xs text-slate-500">{member.email}</p>
        </div>
        <label className="text-xs flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 accent-invictus"
            checked={member.is_install_manager}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Alertas de instalação
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-2 items-center">
        <select
          value={member.role}
          onChange={(e) => onSetRole(e.target.value as Role)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-invictus"
        >
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <input
          inputMode="numeric"
          placeholder="Telefone (55DDD...)"
          pattern="\d{10,13}"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
          className="flex-1 min-w-[160px] border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-invictus"
        />
        <button
          onClick={() => onSavePhone(phone)}
          disabled={!dirty}
          className="px-3 py-1.5 text-xs bg-invictus text-white rounded-lg font-semibold hover:bg-invictus-dark transition disabled:opacity-40"
        >
          Salvar
        </button>
      </div>
    </li>
  );
}
