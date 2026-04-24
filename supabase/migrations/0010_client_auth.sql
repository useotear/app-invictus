-- 0010: conta de cliente (login + senha via Supabase Auth)
-- O admin cria o auth.user e vincula ao clients.auth_user_id.
-- Backend usa service_role (bypassa RLS); estas policies protegem
-- quem conectar via JWT de cliente (authenticated) direto no Supabase.

alter table clients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists must_change_password boolean not null default false;

create unique index if not exists clients_auth_user_id_key
  on clients(auth_user_id) where auth_user_id is not null;

-- ── Helper: client.id do usuário autenticado (cliente final) ─────────────
create or replace function current_client_id() returns uuid
language sql stable as $$
  select id from clients where auth_user_id = auth.uid()
$$;

-- ── clients: cliente lê o próprio registro ───────────────────────────────
drop policy if exists "client reads self" on clients;
create policy "client reads self" on clients
  for select using (auth_user_id = auth.uid());

-- ── projects: cliente lê os próprios projetos ────────────────────────────
drop policy if exists "client reads own projects" on projects;
create policy "client reads own projects" on projects
  for select using (
    client_id in (select id from clients where auth_user_id = auth.uid())
  );

-- ── project_phases: cliente lê fases dos próprios projetos ───────────────
drop policy if exists "client reads own phases" on project_phases;
create policy "client reads own phases" on project_phases
  for select using (
    exists (
      select 1 from projects p
      join clients c on c.id = p.client_id
      where p.id = project_phases.project_id and c.auth_user_id = auth.uid()
    )
  );

-- ── project_documents: cliente lê documentos dos próprios projetos ───────
drop policy if exists "client reads own documents" on project_documents;
create policy "client reads own documents" on project_documents
  for select using (
    exists (
      select 1 from projects p
      join clients c on c.id = p.client_id
      where p.id = project_documents.project_id and c.auth_user_id = auth.uid()
    )
  );

-- ── project_photos: cliente lê fotos dos próprios projetos ───────────────
drop policy if exists "client reads own photos" on project_photos;
create policy "client reads own photos" on project_photos
  for select using (
    exists (
      select 1 from projects p
      join clients c on c.id = p.client_id
      where p.id = project_photos.project_id and c.auth_user_id = auth.uid()
    )
  );

-- ── push_subscriptions: cliente gerencia as próprias assinaturas ─────────
drop policy if exists "client manages own push" on push_subscriptions;
create policy "client manages own push" on push_subscriptions
  for all
  using (client_id in (select id from clients where auth_user_id = auth.uid()))
  with check (client_id in (select id from clients where auth_user_id = auth.uid()));
