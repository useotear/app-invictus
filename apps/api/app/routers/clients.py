import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..config import settings
from ..deps import AdminUser, require_admin
from ..services.whatsapp import send_whatsapp

router = APIRouter(prefix="/clients", tags=["clients"])
limiter = Limiter(key_func=get_remote_address)


class ClientIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., pattern=r"^\d{10,13}$")
    email: str | None = Field(None, max_length=255)
    cpf_cnpj: str | None = Field(None, pattern=r"^\d{11}$|^\d{14}$")


@router.post("")
@limiter.limit("20/minute")
def create_client(
    request: Request,
    payload: ClientIn,
    user: AdminUser = Depends(require_admin),
):
    token = secrets.token_urlsafe(24)
    data = payload.model_dump() | {"access_token": token, "company_id": user.company_id}
    r = db.table("clients").insert(data).execute()
    client = r.data[0]
    client.pop("access_token", None)
    return client


@router.get("")
def list_clients(user: AdminUser = Depends(require_admin)):
    return db.table("clients") \
        .select("id,name,phone,email,cpf_cnpj,created_at") \
        .eq("company_id", user.company_id) \
        .order("created_at", desc=True).execute().data


@router.get("/{client_id}/access-link")
def get_access_link(client_id: str, user: AdminUser = Depends(require_admin)):
    """Admin busca o link do portal do cliente sob demanda (para copiar e enviar manualmente)."""
    r = db.table("clients").select("access_token,company_id") \
        .eq("id", client_id).single().execute()
    if not r.data or r.data["company_id"] != user.company_id:
        raise HTTPException(404)
    return {"link": f"{settings.portal_base_url}/portal/{r.data['access_token']}"}


@router.post("/{client_id}/send-link")
@limiter.limit("10/minute")
async def send_portal_link(
    request: Request,
    client_id: str,
    user: AdminUser = Depends(require_admin),
):
    """Envia o link do portal via WhatsApp manualmente."""
    r = db.table("clients").select("name,phone,access_token,company_id") \
        .eq("id", client_id).single().execute().data
    if not r or r["company_id"] != user.company_id:
        raise HTTPException(404)
    link = f"{settings.portal_base_url}/portal/{r['access_token']}"
    msg = f"Olá {r['name']}! Acompanhe sua instalação fotovoltaica: {link}"
    try:
        await send_whatsapp(r["phone"], msg)
        return {"sent": True}
    except Exception as e:
        raise HTTPException(502, f"Falha ao enviar: {e}")


@router.get("/by-token/{token}")
@limiter.limit("30/minute")
def get_by_token(request: Request, token: str):
    r = db.table("clients").select("id,name,email,phone,company_id") \
        .eq("access_token", token).single().execute()
    if not r.data:
        raise HTTPException(404)
    return r.data
