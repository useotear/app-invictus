-- 0003: campos de pagamento em projects + bucket de storage para documentos

alter table projects
  add column if not exists paid_amount numeric(12,2) default 0 not null,
  add column if not exists payment_method text
    check (payment_method in ('pix','boleto','cartao','transferencia','financiamento','outro'));

-- Bucket privado para documentos dos projetos.
-- Observação: criação do bucket é idempotente. Se preferir, rode manualmente em
-- Storage → Buckets → New bucket ('project-documents', private).
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- Policies: somente equipe da empresa dona do projeto pode ler/escrever.
create policy "team reads project docs"
  on storage.objects for select
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = split_part(name, '/', 1)
        and p.company_id = current_company_id()
    )
  );

create policy "team writes project docs"
  on storage.objects for insert
  with check (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = split_part(name, '/', 1)
        and p.company_id = current_company_id()
    )
  );

create policy "team deletes project docs"
  on storage.objects for delete
  using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from projects p
      where p.id::text = split_part(name, '/', 1)
        and p.company_id = current_company_id()
    )
  );
