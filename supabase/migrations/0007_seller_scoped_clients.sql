-- 0007: vendedor dono do cliente (seller_id em clients) + backfill.
-- Idempotente.
-- O filtro por role é feito no backend (service_role bypassa RLS).

alter table clients
  add column if not exists seller_id uuid references users(id) on delete set null;

create index if not exists clients_seller_idx on clients(seller_id);

-- Backfill: pra clientes existentes, herda o seller_id do primeiro projeto do cliente.
update clients c
   set seller_id = p.seller_id
  from projects p
 where p.client_id = c.id
   and p.seller_id is not null
   and c.seller_id is null;
