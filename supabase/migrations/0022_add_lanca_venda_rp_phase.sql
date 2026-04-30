-- 0022: insere nova fase 3 "lança venda RP" (admin only)
-- Total de fases passa de 13 pra 14. Tudo de phase_number 3+ desloca +1.

alter table project_phases drop constraint if exists project_phases_phase_number_check;
alter table projects drop constraint if exists projects_current_phase_check;
alter table notification_templates drop constraint if exists notification_templates_phase_number_check;
alter table project_photos drop constraint if exists project_photos_phase_number_check;

-- 1) project_phases — shift phase_number 3..13 → 4..14 (via pivô +100)
update project_phases set phase_number = phase_number + 100 where phase_number >= 3;
update project_phases set phase_number = phase_number - 99  where phase_number >= 103;

-- Insere nova fase 3 pra todos os projetos existentes
insert into project_phases (project_id, phase_number, phase_name)
select id, 3, 'lança venda RP'
from projects
where not exists (
  select 1 from project_phases pp
  where pp.project_id = projects.id and pp.phase_number = 3
);

-- 2) projects.current_phase — quem estava em 3+ vira 4+ (skip phase 3)
update projects set current_phase = current_phase + 1 where current_phase >= 3;

-- 3) notification_templates — shift
update notification_templates set phase_number = phase_number + 100 where phase_number >= 3;
update notification_templates set phase_number = phase_number - 99  where phase_number >= 103;

-- 4) project_photos — shift
update project_photos set phase_number = phase_number + 100 where phase_number >= 3;
update project_photos set phase_number = phase_number - 99  where phase_number >= 103;

-- Recria constraints com novo limite (14)
alter table project_phases add constraint project_phases_phase_number_check
  check (phase_number between 1 and 14);
alter table projects add constraint projects_current_phase_check
  check (current_phase between 1 and 14);
alter table notification_templates add constraint notification_templates_phase_number_check
  check (phase_number between 1 and 14);
alter table project_photos add constraint project_photos_phase_number_check
  check (phase_number between 1 and 14);

-- Trigger atualizada (14 fases)
create or replace function seed_project_phases()
returns trigger language plpgsql as $$
declare
  phases text[] := array[
    'Contrato assinado / Pagamento',
    'Compra do kit',
    'lança venda RP',
    'Previsão de entrega do kit',
    'Kit entregue',
    'Instalação agendada',
    'Entrada do projeto',
    'Projeto em análise',
    'Projeto aprovado',
    'Instalação concluída',
    'Troca do relógio agendada',
    'Relógio trocado / Sistema ativo',
    'App de monitoramento instalado',
    'Manutenção agendada'
  ];
  i int;
begin
  for i in 1..14 loop
    insert into project_phases (project_id, phase_number, phase_name)
    values (new.id, i, phases[i]);
  end loop;
  return new;
end $$;
