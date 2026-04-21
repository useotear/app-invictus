import secrets
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db import db
from ..config import settings
from ..services.whatsapp import send_whatsapp

router = APIRouter(prefix="/clients", tags=["clients"])


class ClientIn(BaseModel):
    company_id: str
    name: str
    phone: str
    email: str | None = None
    cpf_cnpj: str | None = None


@router.post("")
async def create_client(payload: ClientIn):
    token = secrets.token_urlsafe(24)
    data = payload.model_dump() | {"access_token": token}
    r = db.table("clients").insert(data).execute()
    client = r.data[0]

    link = f"{settings.portal_base_url}/portal/{token}"
    msg = f"Olá {client['name']}! Acompanhe sua instalação fotovoltaica: {link}"
    try:
        await send_whatsapp(client["phone"], msg)
    except Exception:
        pass  # log silencioso; admin pode reenviar

    return client


@router.get("")
def list_clients(company_id: str):
    return db.table("clients").select("*").eq("company_id", company_id) \
        .order("created_at", desc=True).execute().data


@router.get("/by-token/{token}")
def get_by_token(token: str):
    r = db.table("clients").select("*").eq("access_token", token).single().execute()
    if not r.data:
        raise HTTPException(404)
    return r.data
