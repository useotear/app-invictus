export const PHASES = [
  { n: 1,  name: "Contrato assinado / Pagamento" },
  { n: 2,  name: "Compra do kit" },
  { n: 3,  name: "Previsão de entrega do kit" },
  { n: 4,  name: "Kit entregue" },
  { n: 5,  name: "Entrada do projeto na Celesc" },
  { n: 6,  name: "Projeto em análise" },
  { n: 7,  name: "Projeto aprovado" },
  { n: 8,  name: "Instalação agendada" },
  { n: 9,  name: "Instalação concluída" },
  { n: 10, name: "Troca do relógio agendada" },
  { n: 11, name: "Relógio trocado / Sistema ativo" },
  { n: 12, name: "Manutenção agendada" },
] as const;

export type PhaseStatus = "pending" | "in_progress" | "completed";

export interface Phase {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string;
  status: PhaseStatus;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
}
