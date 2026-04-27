from typing import Annotated

import jwt
from fastapi import Header, HTTPException, Request
from jwt import PyJWKClient

from .config import settings
from .db import db


class AdminUser:
    def __init__(self, user_id: str, email: str, company_id: str, role: str):
        self.user_id = user_id
        self.email = email
        self.company_id = company_id
        self.role = role


class ClientUser:
    def __init__(self, user_id: str, client_id: str, company_id: str, email: str | None, must_change_password: bool):
        self.user_id = user_id
        self.client_id = client_id
        self.company_id = company_id
        self.email = email
        self.must_change_password = must_change_password


_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(url, cache_keys=True, lifespan=3600)
    return _jwks_client


def _decode_supabase_jwt(token: str) -> dict:
    # Modo HS256 (legacy JWT Secret)
    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.InvalidTokenError:
            # Se o projeto migrou para JWKS, cai para o decode por chave pública
            pass

    # Modo RS256/ES256 via JWKS (asymmetric signing keys)
    try:
        key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=["RS256", "ES256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Token inválido: {e}")
    except Exception as e:
        raise HTTPException(500, f"Falha ao buscar JWKS: {e}")


def require_admin(authorization: Annotated[str | None, Header()] = None) -> AdminUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Authorization header ausente")
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_jwt(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Token sem sub")

    rows = db.table("users").select("company_id,role,email,name") \
        .eq("id", user_id).limit(1).execute().data
    if not rows:
        # Não vazar o user_id na resposta; log interno cuida do debug.
        import logging
        logging.getLogger("auth").warning("Usuário autenticado sem vínculo em users: %s", user_id)
        raise HTTPException(403, "Usuário não autorizado")
    row = rows[0]
    return AdminUser(
        user_id=user_id,
        email=row["email"],
        company_id=row["company_id"],
        role=row["role"],
    )


def require_client(authorization: Annotated[str | None, Header()] = None) -> ClientUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Authorization header ausente")
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_jwt(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Token sem sub")

    rows = db.table("clients").select("id,company_id,email,must_change_password") \
        .eq("auth_user_id", user_id).limit(1).execute().data
    if not rows:
        raise HTTPException(403, "Cliente não autorizado")
    row = rows[0]
    return ClientUser(
        user_id=user_id,
        client_id=row["id"],
        company_id=row["company_id"],
        email=row.get("email"),
        must_change_password=row.get("must_change_password", False),
    )


def require_cron_secret(x_cron_secret: Annotated[str | None, Header()] = None) -> None:
    if not settings.cron_secret:
        raise HTTPException(500, "CRON_SECRET não configurado")
    if not x_cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(401, "Cron secret inválido")


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def log_audit(
    *,
    company_id: str | None,
    actor: AdminUser | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    metadata: dict | None = None,
    ip: str | None = None,
) -> None:
    """Grava entrada em audit_log. Nunca levanta — falha silenciosa com log."""
    import logging
    try:
        db.table("audit_log").insert({
            "company_id": company_id,
            "actor_id": actor.user_id if actor else None,
            "actor_email": actor.email if actor else None,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata or {},
            "ip": ip,
        }).execute()
    except Exception as e:
        logging.getLogger("audit").warning("Falha ao gravar audit_log (%s): %s", action, e)
