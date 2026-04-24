-- 0014: telefone do vendedor (pra WhatsApp) + flag de responsável pela instalação.

alter table users
  add column if not exists phone text,
  add column if not exists is_install_manager boolean not null default false;

-- Limpa telefones inválidos pra garantir que o backend consegue mandar WhatsApp.
-- Formato esperado: só dígitos, 10-13 caracteres. Ex: 48999999999 ou 554899999999.
