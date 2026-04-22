from typing import Annotated
import jwt
from jwt import PyJWKClient
from fastapi import Depends, Header, HTTPException, Request
from .config import settings
from .db import db


class AdminUser:
    def __init__(self, user_id: str, email: str, company_id: str, role: str):
        self.user_id = user_id
        self.email = email
        self.company_id = company_id
        self.role = role


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
        raise HTTPException(
            403,
            f"Usuário {user_id} não está vinculado a uma empresa (tabela users). "
            "Rode o INSERT para criar o vínculo.",
        )
    row = rows[0]
    return AdminUser(
        user_id=user_id,
        email=row["email"],
        company_id=row["company_id"],
        role=row["role"],
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
