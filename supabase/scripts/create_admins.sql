-- Cria 3 admins em auth.users + auth.identities + public.users
-- Rode no SQL Editor do Supabase. O SELECT final mostra as senhas geradas.
-- IMPORTANTE: copie as senhas — o hash é só-de-ida e não dá pra recuperar depois.

create extension if not exists pgcrypto;

drop table if exists _admins_tmp;
create table _admins_tmp (email text, password text);

do $$
declare
  company_uuid uuid := '00000000-0000-0000-0000-000000000001';
  inputs text[][] := array[
    array['alissonrafaelbairrosalves@gmail.com', 'Alisson Rafael'],
    array['invictussolucoessolar@gmail.com',     'Invictus Soluções'],
    array['cassiano.slg@gmail.com',              'Cassiano']
  ];
  i int;
  email_lc text;
  user_name text;
  new_uid uuid;
  new_password text;
begin
  for i in 1 .. array_length(inputs, 1) loop
    email_lc := lower(inputs[i][1]);
    user_name := inputs[i][2];
    new_uid := gen_random_uuid();
    new_password := 'Invictus@2026';  -- senha provisória comum; trocar no 1º login

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_uid, 'authenticated', 'authenticated',
      email_lc, crypt(new_password, gen_salt('bf')),
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
    values (new_uid, company_uuid, user_name, email_lc, 'admin');

    insert into _admins_tmp values (email_lc, new_password);
  end loop;
end $$;

select email, password as senha_provisoria from _admins_tmp order by email;

-- Depois de copiar as senhas, limpe o vestígio:
-- drop table _admins_tmp;
