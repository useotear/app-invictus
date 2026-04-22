-- 0004: integração com Celesc (protocolo vinculado a projetos)
-- Idempotente.

alter table projects
  add column if not exists celesc_protocol text;

create unique index if not exists projects_celesc_protocol_key
  on projects(celesc_protocol) where celesc_protocol is not null;

create index if not exists projects_celesc_protocol_lookup
  on projects(celesc_protocol);
