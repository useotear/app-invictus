"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
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
  kwp: string;
  value: string;
  paid: string;
  method: string;
}

const EMPTY_PROJECT: ProjectForm = {
  address: "",
  kwp: "",
  value: "",
  paid: "",
  method: "pix",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf_cnpj: "" });
  const [projectForm, setProjectForm] = useState<Record<string, ProjectForm>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => api.get<Client[]>(`/clients`).then(setClients).catch(() => {});

  useEffect(() => { reload(); }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post("/clients", {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        cpf_cnpj: form.cpf_cnpj || null,
      });
      setForm({ name: "", phone: "", email: "", cpf_cnpj: "" });
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
        system_size_kwp: pf.kwp ? Number(pf.kwp) : null,
        contract_value: pf.value ? Number(pf.value) : null,
        paid_amount: pf.paid ? Number(pf.paid) : 0,
        payment_method: pf.method || null,
      });
      alert("Projeto criado!");
      setProjectForm({ ...projectForm, [clientId]: EMPTY_PROJECT });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao criar projeto");
    }
  }

  async function copyPortalLink(clientId: string) {
    try {
      const { link } = await api.get<{ link: string }>(`/clients/${clientId}/access-link`);
      await navigator.clipboard.writeText(link);
      alert("Link copiado!");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao buscar link");
    }
  }

  async function sendWhatsappLink(clientId: string) {
    if (!confirm("Enviar link do portal por WhatsApp para este cliente?")) return;
    try {
      await api.post(`/clients/${clientId}/send-link`, {});
      alert("Link enviado!");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao enviar");
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg mb-4">Novo cliente</h2>
        <form onSubmit={createClient} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome" className="border rounded px-3 py-2"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Telefone (só dígitos, 10 a 13)" pattern="\d{10,13}"
            className="border rounded px-3 py-2"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input type="email" placeholder="E-mail" className="border rounded px-3 py-2"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="CPF/CNPJ (só dígitos)" pattern="\d{11}|\d{14}"
            className="border rounded px-3 py-2"
            value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} />
          {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
          <button disabled={busy} className="col-span-2 bg-invictus text-white py-2 rounded font-semibold disabled:opacity-50">
            {busy ? "Cadastrando…" : "Cadastrar cliente"}
          </button>
          <p className="col-span-2 text-[11px] text-slate-500 text-center">
            O link do portal fica disponível na lista abaixo e pode ser enviado por WhatsApp manualmente.
          </p>
        </form>
      </section>

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
                <summary className="px-4 py-3 cursor-pointer flex justify-between items-center">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-slate-500">{c.phone}</span>
                </summary>
                <div className="px-4 pb-4 border-t pt-3 space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => copyPortalLink(c.id)} className="text-xs px-3 py-1.5 border border-invictus text-invictus rounded hover:bg-invictus hover:text-white transition">
                      📋 Copiar link do portal
                    </button>
                    <button onClick={() => sendWhatsappLink(c.id)} className="text-xs px-3 py-1.5 border border-emerald-600 text-emerald-700 rounded hover:bg-emerald-600 hover:text-white transition">
                      📱 Enviar por WhatsApp
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Novo projeto</p>
                    <input placeholder="Endereço completo" className="border rounded px-2 py-1 w-full"
                      value={pf.address} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, address: e.target.value }})} />
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
                    <p className="text-[11px] text-slate-500">
                      Após criar o projeto, use a página do projeto para anexar contrato, comprovantes e fotos.
                    </p>
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
    </div>
  );
}
