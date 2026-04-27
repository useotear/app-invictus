-- Cria 4 vendedores em auth.users + auth.identities + public.users
-- Senha provisória comum: Invictus@2026 (cliente troca depois pelo Supabase ou via UI futura).
-- Rodar no SQL Editor do Supabase.

create extension if not exists pgcrypto;

drop table if exists _sellers_tmp;
create table _sellers_tmp (email text, password text);

do $$
declare
  company_uuid uuid := '00000000-0000-0000-0000-000000000001';
  nova_senha   text := 'Invictus@2026';
  inputs text[][] := array[
    array['moreiracarlos069@gmail.com',  'Carlos'],
    array['pedroliralira19@gmail.com',   'Pedro'],
    array['fonsecawillian776@gmail.com', 'Willian'],
    array['joaoronaldocav@gmail.com',    'João']
  ];
  i int;
  email_lc text;
  user_name text;
  new_uid uuid;
begin
  for i in 1 .. array_length(inputs, 1) loop
    email_lc := lower(inputs[i][1]);
    user_name := inputs[i][2];
    new_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_uid, 'authenticated', 'authenticated',
      email_lc, crypt(nova_senha, gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('name', user_name),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_uid,
      jsonb_build_object(
        'sub', new_uid::text,
        'email', email_lc,
        'email_verified', true,
        'provider', 'email'
      ),
      'email', email_lc, now(), now(), now()
    );

    insert into public.users (id, company_id, name, email, role)
    values (new_uid, company_uuid, user_name, email_lc, 'seller');

    insert into _sellers_tmp values (email_lc, nova_senha);
  end loop;
end $$;

select email, password as senha_provisoria from _sellers_tmp order by email;

-- Depois de copiar/repassar:
-- drop table _sellers_tmp;
