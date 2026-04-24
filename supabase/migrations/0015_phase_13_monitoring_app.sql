-- 0015: nova fase 13 — "App de monitoramento instalado"
-- Acontece ~1 semana depois do relógio trocado (fase 11).

-- Relaxa os check constraints pra aceitar phase_number 13.
alter table project_phases drop constraint if exists project_phases_phase_number_check;
alter table project_phases add constraint project_phases_phase_number_check
  check (phase_number between 1 and 13);

alter table projects drop constraint if exists projects_current_phase_check;
alter table projects add constraint projects_current_phase_check
  check (current_phase between 1 and 13);

alter table project_photos drop constraint if exists project_photos_phase_number_check;
alter table project_photos add constraint project_photos_phase_number_check
  check (phase_number between 1 and 13);

alter table notification_templates drop constraint if exists notification_templates_phase_number_check;
alter table notification_templates add constraint notification_templates_phase_number_check
  check (phase_number between 1 and 13);

-- Cria a fase 13 em todos os projetos existentes (se ainda não existir).
insert into project_phases (project_id, phase_number, phase_name)
select id, 13, 'App de monitoramento instalado'
from projects
where not exists (
  select 1 from project_phases pp
  where pp.project_id = projects.id and pp.phase_number = 13
);

-- Atualiza a trigger que instancia as fases ao criar projeto novo.
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
    'Manutenção agendada',
    'App de monitoramento instalado'
  ];
  i int;
begin
  for i in 1..13 loop
    insert into project_phases (project_id, phase_number, phase_name)
    values (new.id, i, phases[i]);
  end loop;
  return new;
end $$;
