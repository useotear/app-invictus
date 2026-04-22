-- Seed único (one-shot): importa 5 clientes/projetos em andamento na Celesc em 22/04/2026.
-- Idempotente: se já rodou, não duplica.
-- Requer migrations 0001..0004 executadas.
-- Cole no Supabase SQL Editor e rode.

DO $$
DECLARE
  v_company uuid := '00000000-0000-0000-0000-000000000001';
  v_client_id uuid;
  v_project_id uuid;

  PROCEDURE upsert_celesc(
    p_name text, p_cpf text, p_phone text, p_email text,
    p_protocol text, p_phase int
  )
  LANGUAGE plpgsql AS $proc$
  DECLARE
    cid uuid;
    pid uuid;
  BEGIN
    SELECT id INTO cid FROM clients
      WHERE company_id = v_company AND cpf_cnpj = p_cpf LIMIT 1;

    IF cid IS NULL THEN
      INSERT INTO clients (company_id, name, phone, email, cpf_cnpj, access_token)
      VALUES (
        v_company, p_name, p_phone, p_email, p_cpf,
        substr(md5(random()::text || clock_timestamp()::text || p_cpf), 1, 32)
      )
      RETURNING id INTO cid;
      RAISE NOTICE 'Cliente criado: % (%)', p_name, p_cpf;
    ELSE
      RAISE NOTICE 'Cliente já existia: % (%)', p_name, p_cpf;
    END IF;

    IF EXISTS (SELECT 1 FROM projects WHERE celesc_protocol = p_protocol) THEN
      RAISE NOTICE 'Projeto já existia para protocolo %', p_protocol;
      RETURN;
    END IF;

    INSERT INTO projects (company_id, client_id, celesc_protocol, current_phase)
    VALUES (v_company, cid, p_protocol, p_phase)
    RETURNING id INTO pid;

    -- Fases 1..p_phase-1 concluídas, p_phase em andamento (trigger já criou as 12)
    UPDATE project_phases
      SET status = 'completed', completed_date = current_date
      WHERE project_id = pid AND phase_number < p_phase;
    UPDATE project_phases
      SET status = 'in_progress'
      WHERE project_id = pid AND phase_number = p_phase;

    RAISE NOTICE 'Projeto criado: % na fase %', p_protocol, p_phase;
  END;
  $proc$;
BEGIN
  -- 1. MARIA APARECIDA MARQUEZ BRANGER — fase 7 (projeto aprovado)
  CALL upsert_celesc(
    'MARIA APARECIDA MARQUEZ BRANGER', '04647156958', '5548998402617',
    'joicebranger@hotmail.com', '8067945609', 7
  );

  -- 2. DANIEL CORREA BATISTOTTI — fase 7
  CALL upsert_celesc(
    'DANIEL CORREA BATISTOTTI', '04835820932', '5548996052057',
    'danielbatistti@yahoo.com.br', '8069471607', 7
  );

  -- 3. BRASIL TECH SUL — fase 7 (CNPJ)
  CALL upsert_celesc(
    'BRASIL TECH SUL INSTALACAO, MANUTENCAO E REPARACAO DE MAQ. IN. LTDA',
    '16564832000170', '5547999157197',
    'administrativo@brasiltechsul.com.br', '8070514508', 7
  );

  -- 4. LUCIANO CORREIA — fase 5 (em análise, com rejeição a reenviar)
  CALL upsert_celesc(
    'LUCIANO CORREIA', '86311352915', '5548991234236',
    'silviaa-maria@hotmail.com', '8068428571', 5
  );

  -- 5. CARINE GIACOMELLI — fase 5 (aguardando análise)
  CALL upsert_celesc(
    'CARINE GIACOMELLI', '92622330006', '5548984611007',
    'nutricarinegiacomelli@gmail.com', '8070321711', 5
  );
END $$;

-- Verificação
SELECT c.name, c.phone, c.email, p.celesc_protocol, p.current_phase
FROM clients c
JOIN projects p ON p.client_id = c.id
WHERE p.celesc_protocol IN ('8067945609','8069471607','8070514508','8068428571','8070321711')
ORDER BY p.current_phase DESC, c.name;
