-- Renomeia a fase 6 de "Entrada do projeto na Celesc" pra "Entrada do projeto"
-- nos projetos existentes. O trigger já foi atualizado em 0020.

update project_phases
set phase_name = 'Entrada do projeto'
where phase_number = 6 and phase_name = 'Entrada do projeto na Celesc';
