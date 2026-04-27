"""Supabase client com HTTP/1.1 forçado globalmente.

O httpx do supabase-py vinha tentando HTTP/2 e a conexão era abortada
intermitentemente (httpcore.RemoteProtocolError, ConnectionTerminated),
fazendo PATCHes de fase falharem silenciosamente. Forçamos HTTP/1.1 em
todos os httpx.Client criados pelo processo, antes de instanciar o
supabase client.
"""

import httpx
from supabase import create_client, Client
from .config import settings

# Monkey-patch httpx pra desligar HTTP/2 por padrão.
# Os sub-clients da supabase-py (postgrest, gotrue, storage) instanciam
# httpx.Client/AsyncClient internamente; com isso herdam http2=False.
_orig_client_init = httpx.Client.__init__
_orig_async_init = httpx.AsyncClient.__init__


def _client_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
    kwargs.setdefault("http2", False)
    return _orig_client_init(self, *args, **kwargs)


def _async_init(self, *args, **kwargs):  # type: ignore[no-untyped-def]
    kwargs.setdefault("http2", False)
    return _orig_async_init(self, *args, **kwargs)


httpx.Client.__init__ = _client_init  # type: ignore[method-assign]
httpx.AsyncClient.__init__ = _async_init  # type: ignore[method-assign]


def get_admin_client() -> Client:
    """Service-role client. Bypassa RLS — usar apenas no backend."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


db: Client = get_admin_client()
