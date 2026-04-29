-- 0021: prioridade manual da fila de instalação (admin pode reordenar)
-- Quando preenchido, sobrescreve a ordem FIFO por data de chegada do kit.
alter table projects
  add column if not exists install_priority int;
