-- Invictus Solar — schema inicial

create extension if not exists "uuid-ossp";

create table companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  logo_url text,
  whatsapp_token text,
  whatsapp_instance text,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin','seller')) default 'seller',
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  email text,
  phone text not null,
  cpf_cnpj text,
  access_token text unique,
  created_at timestamptz not null default now()
);
create index on clients(company_id);
create index on clients(access_token);

create table projects (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  seller_id uuid references users(id),
  address text,
  system_size_kwp numeric(6,2),
  contract_value numeric(12,2),
  current_phase int not null default 1 check (current_phase between 1 and 12),
  created_at timestamptz not null default now(),
  installed_at timestamptz
);
create index on projects(company_id);
create index on projects(client_id);

-- Fases fixas do pipeline (ver PRD seção 3)
create table project_phases (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_number int not null check (phase_number between 1 and 12),
  phase_name text not null,
  status text not null check (status in ('pending','in_progress','completed')) default 'pending',
  scheduled_date date,
  completed_date date,
  notes text,
  updated_by uuid references users(id),
  updated_at timestamptz not null default now(),
  unique (project_id, phase_number)
);
create index on project_phases(project_id);

create table project_documents (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  file_url text not null,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table project_photos (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_number int check (phase_number between 1 and 12),
  photo_url text not null,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table notification_templates (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  phase_number int not null check (phase_number between 1 and 12),
  channel text not null check (channel in ('whatsapp','push','email')),
  recipient text not null check (recipient in ('client','seller','both')),
  template text not null,
  enabled boolean not null default true,
  unique (company_id, phase_number, channel, recipient)
);

create table notifications_log (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','push','email')),
  recipient_type text not null check (recipient_type in ('client','seller','admin')),
  recipient text,
  message text,
  status text not null check (status in ('sent','failed','queued')) default 'queued',
  error text,
  sent_at timestamptz
);
create index on notifications_log(project_id);

create table push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

-- Ao criar projeto, instancia as 12 fases automaticamente
create or replace function seed_project_phases()
returns trigger language plpgsql as $$
declare
  phases text[] := array[
    'Contrato assinado / Pagamento',
    'Compra do kit',
    'Previsão de entrega do kit',
    'Kit entregue',
    'Entrada do projeto na Celesc',
    'Projeto em análise',
    'Projeto aprovado',
    'Instalação agendada',
    'Instalação concluída',
    'Troca do relógio agendada',
    'Relógio trocado / Sistema ativo',
    'Manutenção agendada'
  ];
  i int;
begin
  for i in 1..12 loop
    insert into project_phases (project_id, phase_number, phase_name)
    values (new.id, i, phases[i]);
  end loop;
  return new;
end $$;

create trigger trg_seed_project_phases
after insert on projects
for each row execute function seed_project_phases();
