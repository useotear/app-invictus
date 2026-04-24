-- Normaliza status das fases: só a current_phase fica 'in_progress'.
-- Usar uma vez, após aplicar o fix em schedule() que marcava tudo como in_progress.

update project_phases pp
set status = case
  when pp.completed_date is not null then 'completed'
  when pp.phase_number = p.current_phase then 'in_progress'
  else 'pending'
end
from projects p
where p.id = pp.project_id;
