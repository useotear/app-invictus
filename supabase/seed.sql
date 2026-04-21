-- Seed: Invictus Solar + templates padrão

insert into companies (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Invictus Solar');

-- Templates padrão (PRD seção 4.3)
insert into notification_templates (company_id, phase_number, channel, recipient, template) values
('00000000-0000-0000-0000-000000000001', 1,  'whatsapp', 'both',   'Olá {nome}! Seu contrato foi assinado. Seja bem-vindo à Invictus Solar! Acompanhe seu projeto: {link}'),
('00000000-0000-0000-0000-000000000001', 3,  'whatsapp', 'both',   'Olá {nome}, a previsão de entrega do seu kit é {data}. Acompanhe: {link}'),
('00000000-0000-0000-0000-000000000001', 4,  'whatsapp', 'both',   'Olá {nome}, seu kit foi entregue! Próximo passo: submissão à Celesc. {link}'),
('00000000-0000-0000-0000-000000000001', 5,  'whatsapp', 'client', 'Olá {nome}, seu projeto foi submetido à Celesc. Prazo médio de análise: 15 dias. {link}'),
('00000000-0000-0000-0000-000000000001', 7,  'whatsapp', 'both',   'Ótima notícia, {nome}! Seu projeto foi aprovado pela Celesc. {link}'),
('00000000-0000-0000-0000-000000000001', 8,  'whatsapp', 'both',   'Olá {nome}, sua instalação está agendada para {data}. {link}'),
('00000000-0000-0000-0000-000000000001', 9,  'whatsapp', 'both',   'Olá {nome}, sua instalação foi concluída! Em breve agendaremos a troca do relógio. {link}'),
('00000000-0000-0000-0000-000000000001', 10, 'whatsapp', 'client', 'Olá {nome}, a troca do seu relógio está agendada para {data}. {link}'),
('00000000-0000-0000-0000-000000000001', 11, 'whatsapp', 'both',   'Parabéns {nome}! Seu sistema está ativo e gerando energia. {link}'),
('00000000-0000-0000-0000-000000000001', 12, 'whatsapp', 'client', 'Olá {nome}, já faz 1 ano da sua instalação. Que tal agendar a limpeza? {link}');

-- Versões push (mesmo texto)
insert into notification_templates (company_id, phase_number, channel, recipient, template)
select company_id, phase_number, 'push', recipient, template
from notification_templates
where channel = 'whatsapp' and company_id = '00000000-0000-0000-0000-000000000001';
