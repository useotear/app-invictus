import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..config import settings
from ..deps import AdminUser, log_audit, require_admin
from ..services.whatsapp import send_whatsapp

router = APIRouter(prefix="/clients", tags=["clients"])
limiter = Limiter(key_func=get_remote_address)

TOKEN_TTL_DAYS = 90


class ClientIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., pattern=r"^\d{10,13}$")
    email: str | None = Field(None, max_length=255)
    cpf_cnpj: str | None = Field(None, pattern=r"^\d{11}$|^\d{14}$")
    # Admin pode atribuir o vendedor; seller ignora e recebe o próprio id.
    seller_id: str | None = None


def _new_token_with_expiry() -> tuple[str, str]:
    token = secrets.token_urlsafe(24)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)).isoformat()
    return token, expires_at


def _load_client_for(user: AdminUser, client_id: str, *, columns: str) -> dict:
    """Carrega cliente garantindo que user tem acesso (admin ou dono)."""
    r = db.table("clients").select(f"{columns},company_id,seller_id") \
        .eq("id", client_id).single().execute().data
    if not r or r["company_id"] != user.company_id:
        raise HTTPException(404)
    if user.role == "seller" and r.get("seller_id") != user.user_id:
        raise HTTPException(404)  # 404 propositalmente pra não vazar existência
    return r


def _resolve_seller_id(user: AdminUser, requested: str | None) -> str | None:
    if user.role == "seller":
        return user.user_id
    if requested:
        owner = db.table("users").select("company_id").eq("id", requested).single().execute().data
        if not owner or owner["company_id"] != user.company_id:
            raise HTTPException(400, "seller_id inválido")
    return requested


@router.post("")
@limiter.limit("20/minute")
def create_client(
    request: Request,
    payload: ClientIn,
    user: AdminUser = Depends(require_admin),
):
    seller_id = _resolve_seller_id(user, payload.seller_id)
    token, expires_at = _new_token_with_expiry()
    data = payload.model_dump(exclude={"seller_id"}) | {
        "access_token": token,
        "access_token_expires_at": expires_at,
        "company_id": user.company_id,
        "seller_id": seller_id,
    }
    r = db.table("clients").insert(data).execute()
    client = r.data[0]
    log_audit(
        company_id=user.company_id, actor=user,
        action="client.create", entity_type="client", entity_id=client["id"],
        metadata={"seller_id": seller_id},
    )
    client.pop("access_token", None)
    return client


@router.get("")
def list_clients(user: AdminUser = Depends(require_admin)):
    q = db.table("clients") \
        .select("id,name,phone,email,cpf_cnpj,access_token_expires_at,created_at,seller_id,"
                "seller:users!clients_seller_id_fkey(id,name)") \
        .eq("company_id", user.company_id)
    if user.role == "seller":
        q = q.eq("seller_id", user.user_id)
    return q.order("created_at", desc=True).execute().data


@router.get("/{client_id}/access-link")
def get_access_link(client_id: str, user: AdminUser = Depends(require_admin)):
    c = _load_client_for(user, client_id, columns="access_token,access_token_expires_at")
    return {
        "link": f"{settings.portal_base_url}/portal/{c['access_token']}",
        "expires_at": c.get("access_token_expires_at"),
    }


@router.post("/{client_id}/rotate-link")
@limiter.limit("10/minute")
def rotate_access_link(
    request: Request, client_id: str,
    user: AdminUser = Depends(require_admin),
):
    """Gera novo token (invalida o anterior) com prazo de validade renovado."""
    _load_client_for(user, client_id, columns="id")
    token, expires_at = _new_token_with_expiry()
    db.table("clients").update({
        "access_token": token,
        "access_token_expires_at": expires_at,
    }).eq("id", client_id).execute()
    log_audit(
        company_id=user.company_id, actor=user,
        action="client.rotate_token", entity_type="client", entity_id=client_id,
    )
    return {
        "link": f"{settings.portal_base_url}/portal/{token}",
        "expires_at": expires_at,
    }


@router.post("/{client_id}/send-link")
@limiter.limit("10/minute")
async def send_portal_link(
    request: Request, client_id: str,
    user: AdminUser = Depends(require_admin),
):
    c = _load_client_for(user, client_id, columns="name,phone,access_token")
    link = f"{settings.portal_base_url}/portal/{c['access_token']}"
    msg = f"Olá {c['name']}! Acompanhe sua instalação fotovoltaica: {link}"
    try:
        await send_whatsapp(c["phone"], msg)
        log_audit(
            company_id=user.company_id, actor=user,
            action="client.send_link", entity_type="client", entity_id=client_id,
            metadata={"channel": "whatsapp"},
        )
        return {"sent": True}
    except Exception as e:
        raise HTTPException(502, f"Falha ao enviar: {e}")


def _generate_password() -> str:
    # 12 chars, url-safe (misto de letras/números/-_). Fácil de copiar no WhatsApp.
    return secrets.token_urlsafe(9)


@router.post("/{client_id}/create-access")
@limiter.limit("10/minute")
def create_client_access(
    request: Request, client_id: str,
    user: AdminUser = Depends(require_admin),
):
    """Cria conta Supabase Auth pro cliente (ou reseta senha) e retorna senha temporária."""
    c = _load_client_for(user, client_id, columns="id,name,email,phone,auth_user_id")
    if not c.get("email"):
        raise HTTPException(400, "Cliente sem e-mail. Cadastre um e-mail antes de gerar acesso.")

    password = _generate_password()

    try:
        if c.get("auth_user_id"):
            # Reset de senha: o cliente já tem conta
            db.auth.admin.update_user_by_id(
                c["auth_user_id"],
                {"password": password, "email_confirm": True},
            )
            auth_user_id = c["auth_user_id"]
        else:
            # Cria conta nova
            created = db.auth.admin.create_user({
                "email": c["email"],
                "password": password,
                "email_confirm": True,
                "user_metadata": {"client_id": c["id"], "name": c["name"]},
            })
            auth_user_id = created.user.id
            db.table("clients").update({"auth_user_id": auth_user_id}).eq("id", client_id).execute()

        db.table("clients").update({"must_change_password": True}).eq("id", client_id).execute()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Falha ao criar conta: {e}")

    log_audit(
        company_id=user.company_id, actor=user,
        action="client.create_access", entity_type="client", entity_id=client_id,
    )
    return {
        "email": c["email"],
        "password": password,
        "login_url": f"{settings.portal_base_url}/cliente/login",
    }


class SendCredentialsIn(BaseModel):
    email: str
    password: str


@router.post("/{client_id}/send-credentials")
@limiter.limit("10/minute")
async def send_credentials(
    request: Request, client_id: str,
    payload: SendCredentialsIn,
    user: AdminUser = Depends(require_admin),
):
    c = _load_client_for(user, client_id, columns="name,phone")
    login_url = f"{settings.portal_base_url}/cliente/login"
    msg = (
        f"Olá {c['name']}! Seu acesso ao portal Invictus Solar:\n\n"
        f"🔗 {login_url}\n"
        f"📧 E-mail: {payload.email}\n"
        f"🔑 Senha: {payload.password}\n\n"
        f"Recomendamos trocar a senha no primeiro acesso."
    )
    try:
        await send_whatsapp(c["phone"], msg)
    except Exception as e:
        raise HTTPException(502, f"Falha ao enviar: {e}")
    log_audit(
        company_id=user.company_id, actor=user,
        action="client.send_credentials", entity_type="client", entity_id=client_id,
    )
    return {"sent": True}


@router.get("/by-token/{token}")
@limiter.limit("30/minute")
def get_by_token(request: Request, token: str):
    r = db.table("clients").select("id,name,email,phone,company_id,access_token_expires_at") \
        .eq("access_token", token).single().execute()
    if not r.data:
        raise HTTPException(404)
    exp = r.data.get("access_token_expires_at")
    if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(410, "Link expirado — peça à equipe um novo link.")
    r.data.pop("access_token_expires_at", None)
    return r.data
