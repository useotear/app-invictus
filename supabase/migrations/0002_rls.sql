-- Row Level Security: isolamento multi-tenant + cliente vê só o próprio projeto

alter table companies enable row level security;
alter table users enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table project_phases enable row level security;
alter table project_documents enable row level security;
alter table project_photos enable row level security;
alter table notification_templates enable row level security;
alter table notifications_log enable row level security;
alter table push_subscriptions enable row level security;

-- Helper: company_id do usuário autenticado
create or replace function current_company_id() returns uuid
language sql stable as $$
  select company_id from users where id = auth.uid()
$$;

-- Equipe interna: acesso total dentro da própria empresa
create policy "team sees own company"     on companies          for select using (id = current_company_id());
create policy "team sees own users"       on users              for all    using (company_id = current_company_id());
create policy "team manages clients"      on clients            for all    using (company_id = current_company_id());
create policy "team manages projects"     on projects           for all    using (company_id = current_company_id());
create policy "team manages phases"       on project_phases     for all    using (
  exists (select 1 from projects p where p.id = project_id and p.company_id = current_company_id())
);
create policy "team manages docs"         on project_documents  for all    using (
  exists (select 1 from projects p where p.id = project_id and p.company_id = current_company_id())
);
create policy "team manages photos"       on project_photos     for all    using (
  exists (select 1 from projects p where p.id = project_id and p.company_id = current_company_id())
);
create policy "team manages templates"    on notification_templates for all using (company_id = current_company_id());
create policy "team sees logs"            on notifications_log  for select using (
  exists (select 1 from projects p where p.id = project_id and p.company_id = current_company_id())
);

-- Cliente final não usa auth.users — acesso via access_token validado no backend
-- (FastAPI usa service_role key e valida o token explicitamente).
