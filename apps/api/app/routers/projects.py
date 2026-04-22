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
    system_size_kwp: float | None = Field(None, ge=0, le=10000)
    contract_value: float | None = Field(None, ge=0)
    paid_amount: float = Field(0, ge=0)
    payment_method: str | None = None


class ProjectUpdate(BaseModel):
    address: str | None = Field(None, max_length=500)
    system_size_kwp: float | None = Field(None, ge=0, le=10000)
    contract_value: float | None = Field(None, ge=0)
    paid_amount: float | None = Field(None, ge=0)
    payment_method: str | None = None


def _assert_client_in_company(client_id: str, company_id: str) -> None:
    row = db.table("clients").select("company_id").eq("id", client_id).single().execute().data
    if not row or row["company_id"] != company_id:
        raise HTTPException(404, "Cliente não encontrado")


def _assert_project_in_company(project_id: str, company_id: str) -> dict:
    row = db.table("projects").select("*,company_id").eq("id", project_id).single().execute().data
    if not row or row["company_id"] != company_id:
        raise HTTPException(404, "Projeto não encontrado")
    return row


def _validate_payment_method(method: str | None) -> None:
    if method is not None and method not in PAYMENT_METHODS:
        raise HTTPException(400, f"payment_method inválido (use: {sorted(PAYMENT_METHODS)})")


@router.post("")
def create_project(payload: ProjectIn, user: AdminUser = Depends(require_admin)):
    _assert_client_in_company(payload.client_id, user.company_id)
    _validate_payment_method(payload.payment_method)
    data = payload.model_dump(exclude_none=True) | {"company_id": user.company_id}
    r = db.table("projects").insert(data).execute()
    return r.data[0]


@router.get("")
def list_projects(user: AdminUser = Depends(require_admin)):
    return db.table("projects").select(
        "id,current_phase,address,system_size_kwp,contract_value,paid_amount,payment_method,"
        "created_at,installed_at,"
        "client:clients(id,name,phone,email),seller:users(id,name)"
    ).eq("company_id", user.company_id).order("created_at", desc=True).execute().data


@router.get("/{project_id}")
def get_project(project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_in_company(project_id, user.company_id)
    r = db.table("projects").select(
        "id,current_phase,address,system_size_kwp,contract_value,paid_amount,payment_method,"
        "created_at,installed_at,"
        "client:clients(id,name,phone,email,access_token),"
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
    _assert_project_in_company(project_id, user.company_id)
    _validate_payment_method(payload.payment_method)
    data = payload.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(400, "Nada para atualizar")
    r = db.table("projects").update(data).eq("id", project_id).execute()
    return r.data[0]


@router.get("/by-client-token/{token}")
@limiter.limit("60/minute")
def by_client_token(request: Request, token: str):
    client = db.table("clients").select("id,name,email,phone") \
        .eq("access_token", token).single().execute().data
    if not client:
        raise HTTPException(404, "Token inválido")
    projects = db.table("projects").select(
        "id,current_phase,address,system_size_kwp,contract_value,paid_amount,"
        "payment_method,created_at,installed_at,"
        "phases:project_phases(*),"
        "documents:project_documents(id,name,created_at)"
    ).eq("client_id", client["id"]).execute().data or []
    for p in projects:
        p["phases"] = sorted(p.get("phases") or [], key=lambda x: x["phase_number"])
        p["documents_count"] = len(p.get("documents") or [])
    return {"client": client, "projects": projects}
