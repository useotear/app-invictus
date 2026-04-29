-- 0019: reordena as fases 5-9
-- Antes:                                        Depois:
-- 5  Entrada do projeto na Celesc       →       5  Instalação agendada       (era 8)
-- 6  Projeto em análise                 →       6  Instalação concluída      (era 9)
-- 7  Projeto aprovado                   →       7  Entrada do projeto na Celesc (era 5)
-- 8  Instalação agendada                →       8  Projeto em análise        (era 6)
-- 9  Instalação concluída               →       9  Projeto aprovado          (era 7)
--
-- Permutação:  5→7  6→8  7→9  8→5  9→6
-- Estratégia: move tudo pra phase_number 95-99 temporariamente, depois redistribui.

alter table project_phases drop constraint if exists project_phases_phase_number_check;
alter table projects drop constraint if exists projects_current_phase_check;
alter table notification_templates drop constraint if exists notification_templates_phase_number_check;
alter table project_photos drop constraint if exists project_photos_phase_number_check;

-- 1) project_phases — move pra 95..99, depois redistribui com nome novo
update project_phases set phase_number = 95 where phase_number = 5;
update project_phases set phase_number = 96 where phase_number = 6;
update project_phases set phase_number = 97 where phase_number = 7;
update project_phases set phase_number = 98 where phase_number = 8;
update project_phases set phase_number = 99 where phase_number = 9;

update project_phases set phase_number = 5, phase_name = 'Instalação agendada'             where phase_number = 98;
update project_phases set phase_number = 6, phase_name = 'Instalação concluída'            where phase_number = 99;
update project_phases set phase_number = 7, phase_name = 'Entrada do projeto na Celesc'    where phase_number = 95;
update project_phases set phase_number = 8, phase_name = 'Projeto em análise'              where phase_number = 96;
update project_phases set phase_number = 9, phase_name = 'Projeto aprovado'                where phase_number = 97;

-- 2) projects.current_phase — mesma permutação
update projects set current_phase = 95 where current_phase = 5;
update projects set current_phase = 96 where current_phase = 6;
update projects set current_phase = 97 where current_phase = 7;
update projects set current_phase = 98 where current_phase = 8;
update projects set current_phase = 99 where current_phase = 9;

update projects set current_phase = 5 where current_phase = 98;
update projects set current_phase = 6 where current_phase = 99;
update projects set current_phase = 7 where current_phase = 95;
update projects set current_phase = 8 where current_phase = 96;
update projects set current_phase = 9 where current_phase = 97;

-- 3) notification_templates — move o template junto com o phase_number
update notification_templates set phase_number = 95 where phase_number = 5;
update notification_templates set phase_number = 96 where phase_number = 6;
update notification_templates set phase_number = 97 where phase_number = 7;
update notification_templates set phase_number = 98 where phase_number = 8;
update notification_templates set phase_number = 99 where phase_number = 9;

update notification_templates set phase_number = 5 where phase_number = 98;
update notification_templates set phase_number = 6 where phase_number = 99;
update notification_templates set phase_number = 7 where phase_number = 95;
update notification_templates set phase_number = 8 where phase_number = 96;
update notification_templates set phase_number = 9 where phase_number = 97;

-- 4) project_photos — fotos costumam ser da fase 9 (instalação) que vira fase 6
update project_photos set phase_number = 95 where phase_number = 5;
update project_photos set phase_number = 96 where phase_number = 6;
update project_photos set phase_number = 97 where phase_number = 7;
update project_photos set phase_number = 98 where phase_number = 8;
update project_photos set phase_number = 99 where phase_number = 9;

update project_photos set phase_number = 5 where phase_number = 98;
update project_photos set phase_number = 6 where phase_number = 99;
update project_photos set phase_number = 7 where phase_number = 95;
update project_photos set phase_number = 8 where phase_number = 96;
update project_photos set phase_number = 9 where phase_number = 97;

-- Recria constraints
alter table project_phases add constraint project_phases_phase_number_check
  check (phase_number between 1 and 13);
alter table projects add constraint projects_current_phase_check
  check (current_phase between 1 and 13);
alter table notification_templates add constraint notification_templates_phase_number_check
  check (phase_number between 1 and 13);
alter table project_photos add constraint project_photos_phase_number_check
  check (phase_number between 1 and 13);

-- Atualiza a trigger pra novos projetos nascerem na nova ordem.
create or replace function seed_project_phases()
returns trigger language plpgsql as $$
declare
  phases text[] := array[
    'Contrato assinado / Pagamento',
    'Compra do kit',
    'Previsão de entrega do kit',
    'Kit entregue',
    'Instalação agendada',
    'Instalação concluída',
    'Entrada do projeto na Celesc',
    'Projeto em análise',
    'Projeto aprovado',
    'Troca do relógio agendada',
    'Relógio trocado / Sistema ativo',
    'App de monitoramento instalado',
    'Manutenção agendada'
  ];
  i int;
begin
  for i in 1..13 loop
    insert into project_phases (project_id, phase_number, phase_name)
    values (new.id, i, phases[i]);
  end loop;
  return new;
end $$;
