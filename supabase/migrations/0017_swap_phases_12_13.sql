-- 0017: troca a ordem das fases 12 e 13
-- Antes: 12=Manutenção, 13=App de monitoramento
-- Depois: 12=App de monitoramento (acontece ~7 dias após 11), 13=Manutenção (1 ano)

-- Drop constraints temporariamente pra usar phase_number=99 como pivô.
alter table project_phases drop constraint if exists project_phases_phase_number_check;
alter table projects drop constraint if exists projects_current_phase_check;
alter table notification_templates drop constraint if exists notification_templates_phase_number_check;
alter table project_photos drop constraint if exists project_photos_phase_number_check;

-- 1) project_phases — swap em 3 passos via 99
update project_phases set phase_number = 99 where phase_number = 12;
update project_phases set phase_number = 12,
                          phase_name = 'App de monitoramento instalado'
                      where phase_number = 13;
update project_phases set phase_number = 13,
                          phase_name = 'Manutenção agendada'
                      where phase_number = 99;

-- 2) projects.current_phase — swap
update projects set current_phase = 99 where current_phase = 12;
update projects set current_phase = 12 where current_phase = 13;
update projects set current_phase = 13 where current_phase = 99;

-- 3) notification_templates — swap
update notification_templates set phase_number = 99 where phase_number = 12;
update notification_templates set phase_number = 12 where phase_number = 13;
update notification_templates set phase_number = 13 where phase_number = 99;

-- 4) project_photos — swap (geralmente fotos são de fase 9, mas garantia)
update project_photos set phase_number = 99 where phase_number = 12;
update project_photos set phase_number = 12 where phase_number = 13;
update project_photos set phase_number = 13 where phase_number = 99;

-- Recria constraints
alter table project_phases add constraint project_phases_phase_number_check
  check (phase_number between 1 and 13);
alter table projects add constraint projects_current_phase_check
  check (current_phase between 1 and 13);
alter table notification_templates add constraint notification_templates_phase_number_check
  check (phase_number between 1 and 13);
alter table project_photos add constraint project_photos_phase_number_check
  check (phase_number between 1 and 13);

-- Atualiza a trigger de seed pra novos projetos nascerem na ordem nova.
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
