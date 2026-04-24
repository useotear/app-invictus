-- 0016: roles granulares (admin/seller/homologation/installer/scheduler)
-- Backend usa service_role e aplica regras por fase. RLS aqui é defesa em profundidade.

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('admin','seller','homologation','installer','scheduler'));

-- Helper já existe do 0008: current_user_role()

-- Roles não-seller (homologation, installer, scheduler) enxergam tudo da empresa.
-- RLS de SELECT — sem WITH CHECK, o backend continua responsável por writes.

drop policy if exists "team roles view all clients" on clients;
create policy "team roles view all clients" on clients
  for select
  using (
    company_id = current_company_id()
    and current_user_role() in ('homologation','installer','scheduler')
  );

drop policy if exists "team roles view all projects" on projects;
create policy "team roles view all projects" on projects
  for select
  using (
    company_id = current_company_id()
    and current_user_role() in ('homologation','installer','scheduler')
  );

drop policy if exists "team roles view all phases" on project_phases;
create policy "team roles view all phases" on project_phases
  for select
  using (
    exists (
      select 1 from projects p
      where p.id = project_phases.project_id
        and p.company_id = current_company_id()
    )
    and current_user_role() in ('homologation','installer','scheduler')
  );

drop policy if exists "team roles view all documents" on project_documents;
create policy "team roles view all documents" on project_documents
  for select
  using (
    exists (
      select 1 from projects p
      where p.id = project_documents.project_id
        and p.company_id = current_company_id()
    )
    and current_user_role() in ('homologation','installer','scheduler')
  );

drop policy if exists "team roles view all photos" on project_photos;
create policy "team roles view all photos" on project_photos
  for select
  using (
    exists (
      select 1 from projects p
      where p.id = project_photos.project_id
        and p.company_id = current_company_id()
    )
    and current_user_role() in ('homologation','installer','scheduler')
  );
