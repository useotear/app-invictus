-- 0005: expiração/rotação do access_token do cliente + audit_log.
-- Idempotente.

-- ── Expiração do token do portal do cliente ────────────────────────────────
alter table clients
  add column if not exists access_token_expires_at timestamptz;

-- Novos clientes: 90 dias por padrão. Setado pelo trigger abaixo.
create or replace function set_access_token_expiry()
returns trigger language plpgsql as $$
begin
  if new.access_token_expires_at is null and new.access_token is not null then
    new.access_token_expires_at := now() + interval '90 days';
  end if;
  return new;
end $$;

drop trigger if exists trg_access_token_expiry on clients;
create trigger trg_access_token_expiry
  before insert on clients
  for each row execute function set_access_token_expiry();

-- ── Audit log (repudiation / compliance) ───────────────────────────────────
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid references companies(id) on delete cascade,
  actor_id uuid,                 -- users.id ou null para system/cron
  actor_email text,
  action text not null,          -- ex: phase.advance, doc.upload, doc.delete, client.create, client.rotate_token
  entity_type text not null,     -- ex: project_phase, project_document, client
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_company_idx on audit_log(company_id, created_at desc);
create index if not exists audit_log_entity_idx on audit_log(entity_type, entity_id);

alter table audit_log enable row level security;

drop policy if exists "team reads own audit log" on audit_log;
create policy "team reads own audit log" on audit_log
  for select using (company_id = current_company_id());

-- ── Privacidade: não precisamos mais armazenar a mensagem renderizada em
--    notifications_log. Comentando por referência; o código backend passa a
--    gravar apenas metadata (channel, phase_number).
--    Quem quiser pode rodar em produção:
--    update notifications_log set message = null where sent_at < now() - interval '30 days';
