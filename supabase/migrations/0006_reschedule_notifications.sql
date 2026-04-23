-- 0006: notificar mudança de data (ex: nova previsão do kit, remarcação de instalação).
-- Idempotente.

-- ── Coluna event em notification_templates ────────────────────────────────
alter table notification_templates
  add column if not exists event text not null default 'completed'
    check (event in ('completed', 'rescheduled'));

-- Unique antigo (company, phase, channel, recipient) não distingue eventos:
-- trocamos para incluir event. O nome da constraint é auto-gerado pelo Postgres
-- e pode vir truncado, então dropamos via catálogo.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.notification_templates'::regclass
      and contype = 'u'
      and array_length(conkey, 1) = 4
  loop
    execute format('alter table notification_templates drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists notification_templates_unique_per_event
  on notification_templates (company_id, phase_number, channel, recipient, event);

-- ── Templates padrão para reagendamento ────────────────────────────────────
-- Disparados quando scheduled_date muda em uma fase já concluída.
insert into notification_templates (company_id, phase_number, channel, recipient, template, event)
values
  ('00000000-0000-0000-0000-000000000001', 3,  'whatsapp', 'client',
    'Olá {nome}, atualizamos a previsão de entrega do seu kit para {data}. Acompanhe: {link}', 'rescheduled'),
  ('00000000-0000-0000-0000-000000000001', 8,  'whatsapp', 'client',
    'Olá {nome}, a nova data da sua instalação é {data}. Acompanhe: {link}', 'rescheduled'),
  ('00000000-0000-0000-0000-000000000001', 10, 'whatsapp', 'client',
    'Olá {nome}, a nova data da troca do relógio é {data}. Acompanhe: {link}', 'rescheduled')
on conflict (company_id, phase_number, channel, recipient, event) do nothing;

-- Versão push (mesmo texto) para as mesmas fases
insert into notification_templates (company_id, phase_number, channel, recipient, template, event)
select company_id, phase_number, 'push', recipient, template, event
from notification_templates
where channel = 'whatsapp'
  and event = 'rescheduled'
  and company_id = '00000000-0000-0000-0000-000000000001'
on conflict (company_id, phase_number, channel, recipient, event) do nothing;
