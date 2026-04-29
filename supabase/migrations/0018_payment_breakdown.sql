-- 0018: detalhamento do pagamento (entrada + parcelas)
alter table projects
  add column if not exists down_payment numeric(12,2),
  add column if not exists installments int check (installments is null or installments between 1 and 60);
