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

export const PHASE_DESCRIPTIONS: Record<number, string> = {
  1: "Contrato assinado e entrada registrada. A partir daqui começamos a organizar o seu kit.",
  2: "Compramos todos os equipamentos do seu sistema (painéis, inversor, estrutura).",
  3: "Kit saiu do fornecedor. Em trânsito até o endereço combinado.",
  4: "Kit chegou e está conferido. Pronto para iniciar o processo na Celesc.",
  5: "Documentação enviada para a Celesc abrir a análise do seu projeto.",
  6: "A Celesc está avaliando o projeto técnico. Este passo costuma ser o mais demorado.",
  7: "A Celesc aprovou o projeto. Liberado para agendarmos a instalação.",
  8: "Instalação agendada com a equipe técnica. Você será avisado do horário.",
  9: "Painéis e inversor já estão no seu telhado e conectados.",
  10: "Troca do medidor pela Celesc agendada. Depois dessa etapa o sistema começa a gerar oficialmente.",
  11: "Relógio bidirecional instalado e sistema ativo. Você já está gerando sua própria energia.",
  12: "Manutenção preventiva agendada para garantir o melhor desempenho do sistema.",
};

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
