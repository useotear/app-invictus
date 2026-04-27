"""Supabase client + helper de retry pra erros transientes (HTTP/2 ConnectionTerminated).

O httpx do supabase-py negocia HTTP/2 com Supabase e a conexão é
intermitentemente abortada (httpcore.RemoteProtocolError). Em vez de
mexer no httpx (frágil), envolvemos as operações críticas num retry
curto que recria o client em caso de erro de protocolo.
"""

import logging
import time

from httpcore import RemoteProtocolError as CoreProtocolError
from httpx import RemoteProtocolError as HttpxProtocolError
from supabase import Client, create_client

from .config import settings

_log = logging.getLogger("db")


def get_admin_client() -> Client:
    """Service-role client. Bypassa RLS — usar apenas no backend."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


db: Client = get_admin_client()


def with_retry(fn, *, attempts: int = 3, delay: float = 0.3):
    """Roda `fn()` reciclando o client em RemoteProtocolError. Não trata 4xx/5xx normais."""
    global db
    last: Exception | None = None
    for i in range(attempts):
        try:
            return fn()
        except (CoreProtocolError, HttpxProtocolError) as e:
            last = e
            _log.warning("Supabase HTTP/2 connection terminated (try %d/%d): %s", i + 1, attempts, e)
            db = get_admin_client()  # recicla
            time.sleep(delay * (i + 1))
    assert last is not None
    raise last
