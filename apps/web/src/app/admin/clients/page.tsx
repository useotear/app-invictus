"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Client {
  id: string; name: string; phone: string; email: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf_cnpj: "" });
  const [projectForm, setProjectForm] = useState<{ [id: string]: { address: string; kwp: string; value: string } }>({});
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.get<Client[]>(`/clients`).then(setClients);

  useEffect(() => { reload(); }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    }
  }

  async function createProject(clientId: string) {
    const pf = projectForm[clientId] || { address: "", kwp: "", value: "" };
    try {
      await api.post("/projects", {
        client_id: clientId,
        address: pf.address || null,
        system_size_kwp: pf.kwp ? Number(pf.kwp) : null,
        contract_value: pf.value ? Number(pf.value) : null,
      });
      alert("Projeto criado!");
      setProjectForm({ ...projectForm, [clientId]: { address: "", kwp: "", value: "" } });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao criar projeto");
    }
  }

  async function copyPortalLink(clientId: string) {
    try {
      const { link } = await api.get<{ link: string }>(`/clients/${clientId}/access-link`);
      await navigator.clipboard.writeText(link);
      alert("Link copiado para a área de transferência");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao buscar link");
    }
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg mb-4">Novo cliente</h2>
        <form onSubmit={createClient} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome" className="border rounded px-3 py-2"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Telefone (55489...)" pattern="\d{10,13}" title="Só dígitos (10 a 13)"
            className="border rounded px-3 py-2"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input type="email" placeholder="E-mail" className="border rounded px-3 py-2"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="CPF/CNPJ (só dígitos)" pattern="\d{11}|\d{14}"
            className="border rounded px-3 py-2"
            value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} />
          {error && <p className="col-span-2 text-xs text-red-600">{error}</p>}
          <button className="col-span-2 bg-invictus text-white py-2 rounded font-semibold">
            Cadastrar e enviar link por WhatsApp
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-3">Clientes cadastrados</h2>
        <div className="space-y-3">
          {clients.map((c) => {
            const pf = projectForm[c.id] || { address: "", kwp: "", value: "" };
            return (
              <details key={c.id} className="bg-white rounded shadow">
                <summary className="px-4 py-3 cursor-pointer flex justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-sm text-slate-500">{c.phone}</span>
                </summary>
                <div className="px-4 pb-4 border-t pt-3 space-y-3">
                  <button
                    onClick={() => copyPortalLink(c.id)}
                    className="text-xs px-3 py-1 border border-invictus text-invictus rounded hover:bg-invictus hover:text-white transition"
                  >
                    Copiar link do portal
                  </button>
                  <div className="grid grid-cols-3 gap-2">
                    <input placeholder="Endereço" className="border rounded px-2 py-1 col-span-3"
                      value={pf.address} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, address: e.target.value }})} />
                    <input placeholder="kWp" className="border rounded px-2 py-1"
                      value={pf.kwp} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, kwp: e.target.value }})} />
                    <input placeholder="Valor (R$)" className="border rounded px-2 py-1"
                      value={pf.value} onChange={e => setProjectForm({ ...projectForm, [c.id]: { ...pf, value: e.target.value }})} />
                    <button onClick={() => createProject(c.id)} className="bg-invictus-accent text-slate-900 font-semibold rounded">
                      Criar projeto
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
