create table if not exists client_maintenances (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'canceled')),
  notes text,
  completed_date date,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_maintenances_company_date_idx
  on client_maintenances(company_id, scheduled_date);

create index if not exists client_maintenances_client_date_idx
  on client_maintenances(client_id, scheduled_date);

alter table client_maintenances enable row level security;

drop policy if exists "admin manages all client maintenances" on client_maintenances;
create policy "admin manages all client maintenances" on client_maintenances
  for all
  using (company_id = current_company_id() and current_user_role() = 'admin')
  with check (company_id = current_company_id() and current_user_role() = 'admin');

drop policy if exists "seller manages own client maintenances" on client_maintenances;
create policy "seller manages own client maintenances" on client_maintenances
  for all
  using (
    company_id = current_company_id()
    and current_user_role() = 'seller'
    and exists (
      select 1 from clients c
      where c.id = client_maintenances.client_id
        and c.seller_id = auth.uid()
    )
  )
  with check (
    company_id = current_company_id()
    and current_user_role() = 'seller'
    and exists (
      select 1 from clients c
      where c.id = client_maintenances.client_id
        and c.seller_id = auth.uid()
    )
  );

drop policy if exists "team roles view client maintenances" on client_maintenances;
create policy "team roles view client maintenances" on client_maintenances
  for select
  using (
    company_id = current_company_id()
    and current_user_role() in ('homologation', 'installer', 'scheduler')
  );

drop policy if exists "scheduler manages client maintenances" on client_maintenances;
create policy "scheduler manages client maintenances" on client_maintenances
  for all
  using (
    company_id = current_company_id()
    and current_user_role() = 'scheduler'
  )
  with check (
    company_id = current_company_id()
    and current_user_role() = 'scheduler'
  );
