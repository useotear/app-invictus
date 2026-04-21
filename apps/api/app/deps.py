from typing import Annotated
import jwt
from fastapi import Depends, Header, HTTPException, Request
from .config import settings
from .db import db


class AdminUser:
    def __init__(self, user_id: str, email: str, company_id: str, role: str):
        self.user_id = user_id
        self.email = email
        self.company_id = company_id
        self.role = role


def _decode_supabase_jwt(token: str) -> dict:
    if not settings.supabase_jwt_secret:
        raise HTTPException(500, "SUPABASE_JWT_SECRET não configurado")
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token inválido")


def require_admin(authorization: Annotated[str | None, Header()] = None) -> AdminUser:
    """Valida JWT do Supabase Auth e busca company_id/role em users."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Authorization header ausente")
    token = authorization.split(" ", 1)[1].strip()
    claims = _decode_supabase_jwt(token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Token sem sub")

    row = db.table("users").select("company_id,role,email,name") \
        .eq("id", user_id).single().execute().data
    if not row:
        raise HTTPException(403, "Usuário não vinculado a empresa")
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
    """IP real para rate limiting, respeitando proxy reverso."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
