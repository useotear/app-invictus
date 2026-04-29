-- Cria o Jesus (instalação) em auth.users + auth.identities + public.users
-- Senha provisória: Invictus@2026 — cliente troca depois pelo Supabase ou via UI futura.

create extension if not exists pgcrypto;

do $$
declare
  email_lc     text := 'jesuschrinos7@gmail.com';
  user_name    text := 'Jesus';
  user_role    text := 'installer';
  nova_senha   text := 'Invictus@2026';
  company_uuid uuid := '00000000-0000-0000-0000-000000000001';
  new_uid      uuid := gen_random_uuid();
begin
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

  -- public.users com role 'installer' + flag is_install_manager pra receber
  -- o aviso diário das instalações de amanhã via cron.
  insert into public.users (id, company_id, name, email, role, is_install_manager)
  values (new_uid, company_uuid, user_name, email_lc, user_role, true);

  raise notice 'Criado % com role % e senha %', email_lc, user_role, nova_senha;
end $$;
