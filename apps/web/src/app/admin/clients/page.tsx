"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useDialog } from "@/components/DialogProvider";
import { useToast } from "@/components/ToastProvider";
import { canCreateClient, useMe } from "@/lib/useMe";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  cpf_cnpj?: string | null;
  access_token_expires_at: string | null;
  seller_id: string | null;
  seller: { id: string; name: string } | null;
}

interface Seller {
  id: string;
  name: string;
  email: string;
  role: "admin" | "seller";
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "financiamento", label: "Financiamento" },
  { value: "outro", label: "Outro" },
];

interface ProjectForm {
  address: string;
  location_link: string;
  installation_notes: string;
  kwp: string;
  value: string;
  paid: string;
  method: string;
}

const EMPTY_PROJECT: ProjectForm = {
  address: "",
  location_link: "",
  installation_notes: "",
  kwp: "",
  value: "",
  paid: "",
  method: "pix",
};

type NewClientForm = {
  name: string;
  phone: string;
  email: string;
  cpf_cnpj: string;
  seller_id: string;
  withProject: boolean;
  project: ProjectForm;
};

const EMPTY_NEW_CLIENT: NewClientForm = {
  name: "",
  phone: "",
  email: "",
  cpf_cnpj: "",
  seller_id: "",
  withProject: false,
  project: { ...EMPTY_PROJECT },
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [form, setForm] = useState<NewClientForm>(EMPTY_NEW_CLIENT);
  const [projectForm, setProjectForm] = useState<Record<string, ProjectForm>>({});
  const [editing, setEditing] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialog = useDialog();
  const toast = useToast();
  const { isAdmin, me } = useMe();
  const mayCreate = canCreateClient(me?.role);

  const reload = () => api.get<Client[]>(`/clients`).then(setClients).catch(() => {});

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.get<Seller[]>("/users/sellers").then(setSellers).catch(() => {});
  }, [isAdmin]);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const client = await api.post<{ id: string }>("/clients", {
        name: form.name,
        phone: form.phone,
        email: form.email,
        cpf_cnpj: form.cpf_cnpj || null,
        seller_id: isAdmin && form.seller_id ? form.seller_id : null,
      });

      if (form.withProject) {
        const pf = form.project;
        try {
          await api.post("/projects", {
            client_id: client.id,
            address: pf.address || null,
            location_link: pf.location_link || null,
            installation_notes: pf.installation_notes || null,
            system_size_kwp: pf.kwp ? Number(pf.kwp) : null,
            contract_value: pf.value ? Number(pf.value) : null,
            paid_amount: pf.paid ? Number(pf.paid) : 0,
            payment_method: pf.method || null,
          });
          toast.show({ message: "Cliente e projeto criados.", tone: "success" });
        } catch (err) {
          toast.show({
            message: "Cliente criado, mas o projeto falhou: "
              + (err instanceof Error ? err.message : "tente de novo pela lista."),
            tone: "error",
            duration: 6000,
          });
        }
      } else {
        toast.show({ message: "Cliente criado.", tone: "success" });
      }

      setForm(EMPTY_NEW_CLIENT);
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setBusy(false);
    }
  }

  async function createProject(clientId: string) {
    const pf = projectForm[clientId] || EMPTY_PROJECT;
    try {
      await api.post("/projects", {
        client_id: clientId,
        address: pf.address || null,
        location_link: pf.location_link || null,
        installation_notes: pf.installation_notes || null,
        system_size_kwp: pf.kwp ? Number(pf.kwp) : null,
        contract_value: pf.value ? Number(pf.value) : null,
        paid_amount: pf.paid ? Number(pf.paid) : 0,
        payment_method: pf.method || null,
      });
      await dialog.alert({ title: "Projeto criado", message: "Pronto! O projeto foi adicionado." });
      setProjectForm({ ...projectForm, [clientId]: EMPTY_PROJECT });
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro ao criar projeto",
        message: e instanceof Error ? e.message : "Tente novamente",
        tone: "error",
      });
    }
  }

  async function copyPortalLink(clientId: string) {
    try {
      const { link } = await api.get<{ link: string }>(`/clients/${clientId}/access-link`);
      await navigator.clipboard.writeText(link);
      await dialog.alert({ title: "Link copiado!", message: link });
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Não consegui buscar o link",
        tone: "error",
      });
    }
  }

  async function rotateLink(clientId: string) {
    const ok = await dialog.confirm({
      title: "Rotacionar link do portal",
      message: "O link atual vai parar de funcionar e um novo será gerado (válido por 90 dias).",
      confirmText: "Rotacionar",
      danger: true,
    });
    if (!ok) return;
    try {
      const { link } = await api.post<{ link: string }>(`/clients/${clientId}/rotate-link`, {});
      await navigator.clipboard.writeText(link);
      await dialog.alert({ title: "Novo link gerado e copiado!", message: link });
      reload();
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Falha ao rotacionar",
        tone: "error",
      });
    }
  }

  function expiryLabel(iso: string | null): { text: string; tone: "ok" | "warn" | "expired" } {
    if (!iso) return { text: "sem validade", tone: "ok" };
    const d = new Date(iso);
    const ms = d.getTime() - Date.now();
    if (ms < 0) return { text: "expirado", tone: "expired" };
    const days = Math.round(ms / 86_400_000);
    return { text: `expira em ${days}d`, tone: days < 14 ? "warn" : "ok" };
  }

  async function createClientAccess(clientId: string, clientName: string) {
    const ok = await dialog.confirm({
      title: "Gerar acesso (login/senha)",
      message: `Será gerada uma senha provisória para ${clientName}. Se a conta já existe, a senha atual será substituída.`,
      confirmText: "Gerar",
    });
    if (!ok) return;
    try {
      const r = await api.post<{ email: string; password: string; login_url: string }>(
        `/clients/${clientId}/create-access`, {},
      );
      const msg =
        `🔗 ${r.login_url}\n` +
        `📧 E-mail: ${r.email}\n` +
        `🔑 Senha: ${r.password}`;
      await navigator.clipboard.writeText(msg).catch(() => {});
      const send = await dialog.confirm({
        title: "Credenciais geradas e copiadas",
        message:
          `${msg}\n\nEnviar agora ao cliente pelo WhatsApp?`,
        confirmText: "Enviar por WhatsApp",
        cancelText: "Depois",
      });
      if (send) {
        try {
          await api.post(`/clients/${clientId}/send-credentials`, {
            email: r.email,
            password: r.password,
          });
          toast.show({ message: "Credenciais enviadas pelo WhatsApp.", tone: "success" });
        } catch (e) {
          toast.show({
            message: "Falha ao enviar: " + (e instanceof Error ? e.message : "erro"),
            tone: "error",
            duration: 6000,
          });
        }
      }
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Falha ao gerar acesso",
        tone: "error",
      });
    }
  }

  async function testClientPush(clientId: string, clientName: string) {
    try {
      const r = await api.post<{ ok: boolean; sent: number; subscriptions: number; reason?: string }>(
        "/push/test",
        {
          client_id: clientId,
          title: "Invictus Solar — teste",
          body: `Olá ${clientName.split(" ")[0]}! Este é um teste de notificação.`,
          url: "/cliente",
        },
      );
      if (!r.ok && r.reason) {
        await dialog.alert({ title: "Não foi possível enviar", message: r.reason, tone: "error" });
      } else {
        await dialog.alert({
          title: r.ok ? "Push enviado" : "Falha",
          message: `Enviado para ${r.sent} de ${r.subscriptions} dispositivo(s) do cliente.`,
        });
      }
    } catch (e) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Falha ao enviar",
        tone: "error",
      });
    }
  }

  async function deleteClient(clientId: string, clientName: string) {
    const ok = await dialog.confirm({
      title: `Excluir ${clientName}?`,
      message:
        "Atenção: isso apaga o cliente e TODOS os projetos, fases, documentos e fotos relacionados. " +
        "A conta de acesso do cliente também é removida. Não dá pra desfazer.",
      confirmText: "Excluir tudo",
      cancelText: "Cancelar",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/clients/${clientId}`);
      toast.show({ message: `${clientName} excluído.`, tone: "success", duration: 3000 });
      reload();
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : "Erro ao excluir",
        tone: "error",
        duration: 5000,
      });
    }
  }

  async function sendWhatsappLink(clientId: string) {
    const ok = await dialog.confirm({
      title: "Enviar link por WhatsApp",
      message: "O cliente receberá o link do portal via WhatsApp agora.",
      confirmText: "Enviar",
    });
    if (!ok) return;
    try {
      await api.post(`/clients/${clientId}/send-link`, {});
      await dialog.alert({ title: "Envio na fila", message: "Mensagem sendo enviada por WhatsApp em segundo plano. Se falhar, avisamos no histórico." });
    } catch (e: unknown) {
      await dialog.alert({
        title: "Erro",
        message: e instanceof Error ? e.message : "Falha ao enviar",
        tone: "error",
      });
    }
  }

  async function saveEdit(values: {
    name: string; phone: string; email: string; cpf_cnpj: string; seller_id: string;
  }) {
    if (!editing) return;
    setBusy(true);
    try {
      const body: Record<string, string | null> = {
        name: values.name,
        phone: values.phone,
        email: values.email,
        cpf_cnpj: values.cpf_cnpj || "",
      };
      if (isAdmin) body.seller_id = values.seller_id || null;
      await api.patch(`/clients/${editing.id}`, body);
      toast.show({ message: "Cliente atualizado.", tone: "success", duration: 2500 });
      setEditing(null);
      reload();
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
    <div className="space-y-8">
      {mayCreate && (
      <section className="bg-white rounded-2xl shadow-card p-5 sm:p-6">
        <h2 className="font-bold text-lg text-invictus-deep mb-1">Novo cliente</h2>
        <p className="text-xs text-slate-500 mb-5">
          Preencha os dados do cliente. Se quiser, já cria o primeiro projeto junto.
        </p>
        <form onSubmit={createClient} className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="sr-only">Dados do cliente</legend>
            <Field label="Nome" required>
              <input
                required
                placeholder="Ex: Maria Silva"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Telefone" hint="Só dígitos, com DDD. Ex: 48999999999" required>
                <input
                  required
                  inputMode="numeric"
                  placeholder="48999999999"
                  pattern="\d{10,13}"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                />
              </Field>

              <Field label="CPF ou CNPJ" hint="Só dígitos (opcional)">
                <input
                  inputMode="numeric"
                  placeholder="00000000000"
                  pattern="\d{11}|\d{14}"
                  value={form.cpf_cnpj}
                  onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value.replace(/\D/g, "") })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                />
              </Field>
            </div>

            <Field label="E-mail" hint="Usado como login do cliente no app" required>
              <input
                type="email"
                required
                placeholder="cliente@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
              />
            </Field>

            {isAdmin && (
              <Field label="Atribuir a qual vendedor?" hint="Deixe em branco para sem vendedor">
                <select
                  value={form.seller_id}
                  onChange={(e) => setForm({ ...form, seller_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-invictus"
                >
                  <option value="">—</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.role === "admin" ? "(admin)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-invictus-deep cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 accent-invictus"
              checked={form.withProject}
              onChange={(e) => setForm({ ...form, withProject: e.target.checked })}
            />
            Também criar o primeiro projeto agora
          </label>

          {form.withProject && (
            <fieldset className="space-y-3 border-l-2 border-invictus-accent pl-4">
              <legend className="text-[10px] font-semibold tracking-widest text-invictus uppercase">
                Primeiro projeto
              </legend>

              <Field label="Endereço da instalação">
                <input
                  placeholder="Rua, número — bairro, cidade/UF"
                  value={form.project.address}
                  onChange={(e) => setForm({ ...form, project: { ...form.project, address: e.target.value } })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                />
              </Field>

              <Field label="Link da localização" hint="Opcional — Google Maps, Waze ou similar. Ajuda a equipe a encontrar o endereço.">
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={form.project.location_link}
                  onChange={(e) => setForm({ ...form, project: { ...form.project, location_link: e.target.value } })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                />
              </Field>

              <Field label="Necessidades da obra" hint="Só a equipe vê — materiais extras, apoio, equipamentos específicos etc.">
                <textarea
                  rows={3}
                  placeholder="Ex: mourão para laje, guindaste, andaime, etc."
                  value={form.project.installation_notes}
                  onChange={(e) => setForm({ ...form, project: { ...form.project, installation_notes: e.target.value } })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus resize-y"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Potência (kWp)">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="5.50"
                    value={form.project.kwp}
                    onChange={(e) => setForm({ ...form, project: { ...form.project, kwp: e.target.value } })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                  />
                </Field>

                <Field label="Forma de pagamento">
                  <select
                    value={form.project.method}
                    onChange={(e) => setForm({ ...form, project: { ...form.project, method: e.target.value } })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-invictus"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Valor total do projeto (R$)">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="25000.00"
                    value={form.project.value}
                    onChange={(e) => setForm({ ...form, project: { ...form.project, value: e.target.value } })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                  />
                </Field>

                <Field label="Valor já pago (R$)" hint="Deixe 0 se nada foi pago">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.project.paid}
                    onChange={(e) => setForm({ ...form, project: { ...form.project, paid: e.target.value } })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-invictus"
                  />
                </Field>
              </div>

              {form.project.value && Number(form.project.value) > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-invictus-accent"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((Number(form.project.paid || 0) / Number(form.project.value)) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-invictus">
                    {Math.min(
                      100,
                      Math.round((Number(form.project.paid || 0) / Number(form.project.value)) * 100),
                    )}% pago
                  </span>
                </div>
              )}
            </fieldset>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className="w-full bg-invictus text-white py-3 rounded-xl font-semibold hover:bg-invictus-dark transition disabled:opacity-50"
          >
            {busy ? "Cadastrando…" : form.withProject ? "Cadastrar cliente + projeto" : "Cadastrar cliente"}
          </button>
          <p className="text-[11px] text-slate-500 text-center">
            O link do portal fica disponível na lista abaixo e pode ser enviado por WhatsApp.
          </p>
        </form>
      </section>
      )}

      <section>
        <h2 className="font-bold text-lg mb-3">Clientes cadastrados</h2>
        <div className="space-y-3">
          {clients.map((c) => {
            const pf = projectForm[c.id] || EMPTY_PROJECT;
            const pct = pf.value && Number(pf.value) > 0
              ? Math.min(100, Math.round((Number(pf.paid || 0) / Number(pf.value)) * 100))
              : 0;
            return (
              <details key={c.id} className="bg-white rounded shadow">
                <summary className="px-4 py-3 cursor-pointer flex justify-between items-center gap-2">
                  <span className="font-medium truncate">{c.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    {isAdmin && c.seller?.name && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {c.seller.name}
                      </span>
                    )}
                    <span className="text-sm text-slate-500">{c.phone}</span>
                  </span>
                </summary>
                <div className="px-4 pb-4 border-t pt-3 space-y-4">
                  <div className="flex gap-2 flex-wrap items-center">
                    <button onClick={() => copyPortalLink(c.id)} className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded hover:bg-invictus hover:text-white transition">
                      📋 Copiar link
                    </button>
                    <button onClick={() => sendWhatsappLink(c.id)} className="text-xs px-3 py-1.5 border border-emerald-600 text-emerald-700 rounded hover:bg-emerald-600 hover:text-white transition">
                      📱 Enviar por WhatsApp
                    </button>
                    <button onClick={() => rotateLink(c.id)} className="text-xs px-3 py-1.5 border border-red-400 text-red-600 rounded hover:bg-red-500 hover:text-white transition">
                      🔄 Rotacionar
                    </button>
                    <button onClick={() => createClientAccess(c.id, c.name)} className="text-xs px-3 py-1.5 border border-invictus-deep text-invictus-deep rounded hover:bg-invictus-deep hover:text-white transition">
                      🔐 Gerar acesso
                    </button>
                    <button onClick={() => setEditing(c)} className="text-xs px-3 py-1.5 border border-slate-400 text-slate-700 rounded hover:bg-slate-100 transition">
                      ✏️ Editar dados
                    </button>
                    <button onClick={() => testClientPush(c.id, c.name)} className="text-xs px-3 py-1.5 border border-purple-500 text-purple-700 rounded hover:bg-purple-500 hover:text-white transition">
                      📲 Testar push
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteClient(c.id, c.name)} className="text-xs px-3 py-1.5 border border-red-600 text-red-700 rounded hover:bg-red-600 hover:text-white transition">
                        🗑️ Excluir
                      </button>
                    )}
                    {(() => {
                      const e = expiryLabel(c.access_token_expires_at);
                      const tone = e.tone === "expired" ? "bg-red-100 text-red-700" :
                                   e.tone === "warn" ? "bg-amber-100 text-amber-800" :
                                   "bg-slate-100 text-slate-600";
                      return <span className={`text-[10px] px-2 py-1 rounded font-semibold ${tone}`}>{e.text}</span>;
                    })()}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Novo projeto</p>
                    <input placeholder="Endereço completo" className="border rounded px-2 py-1 w-full"
                      value={pf.address} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, address: e.target.value }})} />
                    <input type="url" placeholder="Link da localização (Google Maps) — opcional" className="border rounded px-2 py-1 w-full"
                      value={pf.location_link} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, location_link: e.target.value }})} />
                    <textarea rows={2} placeholder="Necessidades da obra — visível só pra equipe (materiais extras, apoio…)" className="border rounded px-2 py-1 w-full resize-y"
                      value={pf.installation_notes} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, installation_notes: e.target.value }})} />
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="kWp" type="number" step="0.01" className="border rounded px-2 py-1"
                        value={pf.kwp} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, kwp: e.target.value }})} />
                      <input placeholder="Valor do contrato (R$)" type="number" step="0.01" className="border rounded px-2 py-1"
                        value={pf.value} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, value: e.target.value }})} />
                      <input placeholder="Valor pago (R$)" type="number" step="0.01" className="border rounded px-2 py-1"
                        value={pf.paid} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, paid: e.target.value }})} />
                      <select className="border rounded px-2 py-1"
                        value={pf.method} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, method: e.target.value }})}>
                        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    {pf.value && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-invictus-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-invictus">{pct}% pago</span>
                      </div>
                    )}
                    <button onClick={() => createProject(c.id)} className="w-full bg-invictus-accent text-invictus-deep font-semibold py-2 rounded hover:brightness-110 transition">
                      Criar projeto
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
          {clients.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6">Nenhum cliente cadastrado ainda.</p>
          )}
        </div>
      </section>

      {editing && (
        <EditClientModal
          client={editing}
          sellers={sellers}
          isAdmin={isAdmin}
          busy={busy}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditClientModal({
  client, sellers, isAdmin, busy, onSave, onClose,
}: {
  client: Client;
  sellers: Seller[];
  isAdmin: boolean;
  busy: boolean;
  onSave: (v: { name: string; phone: string; email: string; cpf_cnpj: string; seller_id: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone);
  const [email, setEmail] = useState(client.email ?? "");
  const [cpf, setCpf] = useState(client.cpf_cnpj ?? "");
  const [sellerId, setSellerId] = useState(client.seller_id ?? "");

  return (
    <div className="fixed inset-0 z-50 bg-invictus-deep/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden mx-auto">
        <div className="bg-invictus text-white px-5 py-4 flex justify-between items-start">
          <h3 className="font-bold text-lg">Editar cliente</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave({ name, phone, email, cpf_cnpj: cpf, seller_id: sellerId }); }}
          className="p-5 space-y-3"
        >
          <Field label="Nome" required>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
            />
          </Field>
          <Field label="Telefone" hint="Só dígitos. Ex: 48999999999">
            <input
              required
              inputMode="numeric"
              pattern="\d{10,13}"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
            />
          </Field>
          <Field label="E-mail" required>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
            />
          </Field>
          <Field label="CPF ou CNPJ" hint="Só dígitos (opcional)">
            <input
              inputMode="numeric"
              pattern="\d{11}|\d{14}"
              value={cpf}
              onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-invictus"
            />
          </Field>
          {isAdmin && (
            <Field label="Vendedor">
              <select
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-invictus"
              >
                <option value="">— sem vendedor —</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-invictus text-white rounded-lg text-sm font-semibold hover:bg-invictus-dark transition disabled:opacity-60"
            >
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-invictus-deep">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {hint && <span className="block text-[11px] text-slate-400 mb-1">{hint}</span>}
      <div className={hint ? "" : "mt-1"}>{children}</div>
    </label>
  );
}
