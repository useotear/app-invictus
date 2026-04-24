from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..deps import AdminUser, require_admin

router = APIRouter(prefix="/projects", tags=["projects"])
limiter = Limiter(key_func=get_remote_address)


PAYMENT_METHODS = {"pix", "boleto", "cartao", "transferencia", "financiamento", "outro"}


class ProjectIn(BaseModel):
    client_id: str
    seller_id: str | None = None
    address: str | None = Field(None, max_length=500)
    location_link: str | None = Field(None, max_length=1000)
    system_size_kwp: float | None = Field(None, ge=0, le=10000)
    contract_value: float | None = Field(None, ge=0)
    paid_amount: float = Field(0, ge=0)
    payment_method: str | None = None


class ProjectUpdate(BaseModel):
    address: str | None = Field(None, max_length=500)
    location_link: str | None = Field(None, max_length=1000)
    system_size_kwp: float | None = Field(None, ge=0, le=10000)
    contract_value: float | None = Field(None, ge=0)
    paid_amount: float | None = Field(None, ge=0)
    payment_method: str | None = None


def _assert_client_access(client_id: str, user: AdminUser) -> dict:
    row = db.table("clients").select("company_id,seller_id") \
        .eq("id", client_id).single().execute().data
    if not row or row["company_id"] != user.company_id:
        raise HTTPException(404, "Cliente não encontrado")
    if user.role == "seller" and row.get("seller_id") != user.user_id:
        raise HTTPException(404, "Cliente não encontrado")
    return row


def _assert_project_access(project_id: str, user: AdminUser) -> dict:
    row = db.table("projects").select("*,company_id,seller_id") \
        .eq("id", project_id).single().execute().data
    if not row or row["company_id"] != user.company_id:
        raise HTTPException(404, "Projeto não encontrado")
    if user.role == "seller" and row.get("seller_id") != user.user_id:
        raise HTTPException(404, "Projeto não encontrado")
    return row


def _resolve_seller_id(user: AdminUser, requested: str | None) -> str | None:
    if user.role == "seller":
        return user.user_id
    if requested:
        owner = db.table("users").select("company_id") \
            .eq("id", requested).single().execute().data
        if not owner or owner["company_id"] != user.company_id:
            raise HTTPException(400, "seller_id inválido")
    return requested


def _validate_payment_method(method: str | None) -> None:
    if method is not None and method not in PAYMENT_METHODS:
        raise HTTPException(400, f"payment_method inválido (use: {sorted(PAYMENT_METHODS)})")


@router.post("")
def create_project(payload: ProjectIn, user: AdminUser = Depends(require_admin)):
    client = _assert_client_access(payload.client_id, user)
    _validate_payment_method(payload.payment_method)
    seller_id = _resolve_seller_id(user, payload.seller_id) or client.get("seller_id")
    data = payload.model_dump(exclude_none=True, exclude={"seller_id"}) | {
        "company_id": user.company_id,
        "seller_id": seller_id,
    }
    r = db.table("projects").insert(data).execute()
    return r.data[0]


@router.get("")
def list_projects(user: AdminUser = Depends(require_admin)):
    q = db.table("projects").select(
        "id,current_phase,address,location_link,system_size_kwp,contract_value,paid_amount,payment_method,"
        "created_at,updated_at,installed_at,seller_id,"
        "client:clients(id,name,phone,email),"
        "seller:users!projects_seller_id_fkey(id,name)"
    ).eq("company_id", user.company_id)
    if user.role == "seller":
        q = q.eq("seller_id", user.user_id)
    return q.order("created_at", desc=True).execute().data


@router.get("/{project_id}")
def get_project(project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_access(project_id, user)
    r = db.table("projects").select(
        "id,current_phase,address,location_link,system_size_kwp,contract_value,paid_amount,payment_method,"
        "created_at,updated_at,installed_at,seller_id,"
        "client:clients(id,name,phone,email,access_token),"
        "seller:users!projects_seller_id_fkey(id,name),"
        "phases:project_phases(*),"
        "documents:project_documents(*),photos:project_photos(*)"
    ).eq("id", project_id).single().execute()
    if not r.data:
        raise HTTPException(404)
    r.data["phases"] = sorted(r.data.get("phases") or [], key=lambda p: p["phase_number"])
    return r.data


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user: AdminUser = Depends(require_admin),
):
    _assert_project_access(project_id, user)
    _validate_payment_method(payload.payment_method)
    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(400, "Nada para atualizar")
    r = db.table("projects").update(data).eq("id", project_id).execute()
    return r.data[0]


@router.get("/by-client-token/{token}")
@limiter.limit("60/minute")
def by_client_token(request: Request, token: str):
    from datetime import datetime, timezone
    client = db.table("clients").select("id,name,email,phone,access_token_expires_at") \
        .eq("access_token", token).single().execute().data
    if not client:
        raise HTTPException(404, "Token inválido")
    exp = client.get("access_token_expires_at")
    if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(timezone.utc):
        raise HTTPException(410, "Link expirado — peça à equipe um novo link.")
    client.pop("access_token_expires_at", None)
    projects = db.table("projects").select(
        "id,current_phase,address,location_link,system_size_kwp,contract_value,paid_amount,"
        "payment_method,created_at,installed_at,"
        "phases:project_phases(*),"
        "documents:project_documents(id,name,created_at)"
    ).eq("client_id", client["id"]).execute().data or []
    for p in projects:
        p["phases"] = sorted(p.get("phases") or [], key=lambda x: x["phase_number"])
        p["documents_count"] = len(p.get("documents") or [])
    return {"client": client, "projects": projects}
