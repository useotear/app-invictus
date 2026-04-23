"""
Smoke test de RLS — opt-in via env SUPABASE_URL + SUPABASE_ANON_KEY reais.

Em CI sem credenciais reais, os testes são pulados. Quando rodados contra
um projeto Supabase real, confirmam que o cliente anon NÃO lê tabelas
multi-tenant (o que significa que a RLS não foi esquecida em nenhuma tabela).
"""
import os

import pytest
from supabase import create_client

REAL_URL = os.getenv("SUPABASE_URL_REAL") or ""
REAL_ANON = os.getenv("SUPABASE_ANON_KEY_REAL") or ""

pytestmark = pytest.mark.skipif(
    not (REAL_URL.startswith("https://") and REAL_ANON and "stub" not in REAL_URL),
    reason="Precisa de SUPABASE_URL_REAL e SUPABASE_ANON_KEY_REAL apontando pra um projeto real",
)


TENANT_TABLES = [
    "companies",
    "users",
    "clients",
    "projects",
    "project_phases",
    "project_documents",
    "project_photos",
    "notification_templates",
    "notifications_log",
    "push_subscriptions",
]


@pytest.fixture(scope="module")
def anon_client():
    return create_client(REAL_URL, REAL_ANON)


@pytest.mark.parametrize("table", TENANT_TABLES)
def test_anon_cannot_read_tenant_table(anon_client, table):
    resp = anon_client.table(table).select("*").limit(1).execute()
    # RLS correta retorna lista vazia pro anon, nunca linhas reais.
    assert resp.data == [], f"RLS falhou: anon leu {len(resp.data)} linha(s) de {table}"
