-- 0008: RLS por role — admin vê tudo da company, seller só os próprios clientes/projetos.
-- Defesa em profundidade: o backend usa service_role (bypassa RLS), então essas
-- políticas só entram em ação se alguém conectar via anon/authenticated direto.
-- Idempotente.

-- ── Helper: role do usuário autenticado ─────────────────────────────────
create or replace function current_user_role() returns text
language sql stable as $$
  select role from users where id = auth.uid()
$$;

-- ── clients ──────────────────────────────────────────────────────────────
drop policy if exists "team manages clients"      on clients;
drop policy if exists "admin manages all clients" on clients;
drop policy if exists "seller manages own clients" on clients;

create policy "admin manages all clients" on clients
  for all
  using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

create policy "seller manages own clients" on clients
  for all
  using (
    company_id = current_company_id()
    and current_user_role() = 'seller'
    and seller_id = auth.uid()
  )
  with check (
    company_id = current_company_id()
    and current_user_role() = 'seller'
    and seller_id = auth.uid()
  );

-- ── projects ─────────────────────────────────────────────────────────────
drop policy if exists "team manages projects"      on projects;
drop policy if exists "admin manages all projects" on projects;
drop policy if exists "seller manages own projects" on projects;

create policy "admin manages all projects" on projects
  for all
  using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

create policy "seller manages own projects" on projects
  for all
  using (
    company_id = current_company_id()
    and current_user_role() = 'seller'
    and seller_id = auth.uid()
  )
  with check (
    company_id = current_company_id()
    and current_user_role() = 'seller'
    and seller_id = auth.uid()
  );

-- ── project_phases ───────────────────────────────────────────────────────
drop policy if exists "team manages phases"      on project_phases;
drop policy if exists "admin manages all phases" on project_phases;
drop policy if exists "seller manages own phases" on project_phases;

create policy "admin manages all phases" on project_phases
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_phases.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_phases.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  );

create policy "seller manages own phases" on project_phases
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_phases.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_phases.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  );

-- ── project_documents ────────────────────────────────────────────────────
drop policy if exists "team manages docs"      on project_documents;
drop policy if exists "admin manages all docs" on project_documents;
drop policy if exists "seller manages own docs" on project_documents;

create policy "admin manages all docs" on project_documents
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_documents.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_documents.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  );

create policy "seller manages own docs" on project_documents
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_documents.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_documents.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  );

-- ── project_photos ───────────────────────────────────────────────────────
drop policy if exists "team manages photos"      on project_photos;
drop policy if exists "admin manages all photos" on project_photos;
drop policy if exists "seller manages own photos" on project_photos;

create policy "admin manages all photos" on project_photos
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_photos.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_photos.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  );

create policy "seller manages own photos" on project_photos
  for all
  using (
    exists (
      select 1 from projects p
      where p.id = project_photos.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from projects p
      where p.id = project_photos.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  );

-- ── notifications_log ────────────────────────────────────────────────────
drop policy if exists "team sees logs"     on notifications_log;
drop policy if exists "admin reads all logs" on notifications_log;
drop policy if exists "seller reads own logs" on notifications_log;

create policy "admin reads all logs" on notifications_log
  for select
  using (
    exists (
      select 1 from projects p
      where p.id = notifications_log.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'admin'
    )
  );

create policy "seller reads own logs" on notifications_log
  for select
  using (
    exists (
      select 1 from projects p
      where p.id = notifications_log.project_id
        and p.company_id = current_company_id()
        and current_user_role() = 'seller'
        and p.seller_id = auth.uid()
    )
  );

-- ── notification_templates ───────────────────────────────────────────────
-- Todo mundo lê (precisa renderizar no backend). Só admin escreve/remove.
drop policy if exists "team manages templates" on notification_templates;
drop policy if exists "team reads templates"   on notification_templates;
drop policy if exists "admin writes templates" on notification_templates;

create policy "team reads templates" on notification_templates
  for select using (company_id = current_company_id());

create policy "admin writes templates" on notification_templates
  for insert with check (
    company_id = current_company_id() and current_user_role() = 'admin'
  );
create policy "admin updates templates" on notification_templates
  for update
  using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');
create policy "admin deletes templates" on notification_templates
  for delete using (
    company_id = current_company_id() and current_user_role() = 'admin'
  );

-- ── Storage (bucket project-documents) ───────────────────────────────────
drop policy if exists "team reads project docs"   on storage.objects;
drop policy if exists "team writes project docs"  on storage.objects;
drop policy if exists "team deletes project docs" on storage.objects;
drop policy if exists "role reads project docs"   on storage.objects;
drop policy if exists "role writes project docs"  on storage.objects;
drop policy if exists "role deletes project docs" on storage.objects;

create policy "role reads project docs"
  on storage.objects for select
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = split_part(name, '/', 1)
        and p.company_id = current_company_id()
        and (current_user_role() = 'admin' or p.seller_id = auth.uid())
    )
  );

create policy "role writes project docs"
  on storage.objects for insert
  with check (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = split_part(name, '/', 1)
        and p.company_id = current_company_id()
        and (current_user_role() = 'admin' or p.seller_id = auth.uid())
    )
  );

create policy "role deletes project docs"
  on storage.objects for delete
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = split_part(name, '/', 1)
        and p.company_id = current_company_id()
        and (current_user_role() = 'admin' or p.seller_id = auth.uid())
    )
  );
