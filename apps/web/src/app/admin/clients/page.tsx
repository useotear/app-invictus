"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

interface Client {
  id: string; name: string; phone: string; email: string | null; access_token: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf_cnpj: "" });
  const [projectForm, setProjectForm] = useState<{ [id: string]: { address: string; kwp: string; value: string } }>({});

  const reload = () => api.get<Client[]>(`/clients?company_id=${COMPANY_ID}`).then(setClients);

  useEffect(() => { reload(); }, []);

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/clients", { company_id: COMPANY_ID, ...form });
    setForm({ name: "", phone: "", email: "", cpf_cnpj: "" });
    reload();
  }

  async function createProject(clientId: string) {
    const pf = projectForm[clientId] || { address: "", kwp: "", value: "" };
    await api.post("/projects", {
      company_id: COMPANY_ID,
      client_id: clientId,
      address: pf.address || null,
      system_size_kwp: pf.kwp ? Number(pf.kwp) : null,
      contract_value: pf.value ? Number(pf.value) : null,
    });
    alert("Projeto criado!");
    setProjectForm({ ...projectForm, [clientId]: { address: "", kwp: "", value: "" } });
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-bold text-lg mb-4">Novo cliente</h2>
        <form onSubmit={createClient} className="grid grid-cols-2 gap-3">
          <input required placeholder="Nome" className="border rounded px-3 py-2"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Telefone (55489...)" className="border rounded px-3 py-2"
            value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="E-mail" className="border rounded px-3 py-2"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="CPF/CNPJ" className="border rounded px-3 py-2"
            value={form.cpf_cnpj} onChange={e => setForm({ ...form, cpf_cnpj: e.target.value })} />
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
                  <p className="text-xs text-slate-500 break-all">
                    Portal: <code>/portal/{c.access_token}</code>
                  </p>
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
