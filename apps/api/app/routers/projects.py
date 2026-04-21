from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..db import db

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectIn(BaseModel):
    company_id: str
    client_id: str
    seller_id: str | None = None
    address: str | None = None
    system_size_kwp: float | None = None
    contract_value: float | None = None


@router.post("")
def create_project(payload: ProjectIn):
    r = db.table("projects").insert(payload.model_dump()).execute()
    return r.data[0]


@router.get("")
def list_projects(company_id: str):
    return db.table("projects").select(
        "*, client:clients(name,phone,email), seller:users(name)"
    ).eq("company_id", company_id).order("created_at", desc=True).execute().data


@router.get("/{project_id}")
def get_project(project_id: str):
    r = db.table("projects").select(
        "*, client:clients(*), phases:project_phases(*), "
        "documents:project_documents(*), photos:project_photos(*)"
    ).eq("id", project_id).single().execute()
    if not r.data:
        raise HTTPException(404)
    # ordena fases
    r.data["phases"] = sorted(r.data.get("phases") or [], key=lambda p: p["phase_number"])
    return r.data


@router.get("/by-client-token/{token}")
def by_client_token(token: str):
    """Portal do cliente: retorna todos os projetos vinculados ao token."""
    client = db.table("clients").select("id,name,email,phone") \
        .eq("access_token", token).single().execute().data
    if not client:
        raise HTTPException(404, "Token inválido")
    projects = db.table("projects").select(
        "*, phases:project_phases(*)"
    ).eq("client_id", client["id"]).execute().data or []
    for p in projects:
        p["phases"] = sorted(p.get("phases") or [], key=lambda x: x["phase_number"])
    return {"client": client, "projects": projects}
