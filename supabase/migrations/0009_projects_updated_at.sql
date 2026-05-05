-- 0009: coluna updated_at em projects, com trigger de auto-atualização.
-- Idempotente. Necessário para os cards do admin ("há 3d", filtro "sem mexer").

alter table projects
  add column if not exists updated_at timestamptz not null default now();

-- Backfill: usa created_at como ponto de partida para quem já existe.
update projects
   set updated_at = coalesce(updated_at, created_at, now())
 where updated_at is null;

-- Função genérica (pode ser reaproveitada).
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();
