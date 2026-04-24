-- Observações internas da obra (comercial/instalação). Não é exposto ao cliente.
alter table projects
  add column if not exists installation_notes text;
