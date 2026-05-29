"""Maintenance scheduling and cron jobs."""
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from ..db import db
from ..deps import AdminUser, log_audit, require_admin, require_cron_secret
from ..permissions import sees_all_clients
from ..services.notifications import dispatch_phase_notifications, notify_upcoming_installs

router = APIRouter(tags=["maintenance"])

MAINTENANCE_ROLES = {"admin", "seller", "scheduler"}


class MaintenanceIn(BaseModel):
    client_id: str
    scheduled_date: date
    notes: str | None = Field(None, max_length=2000)


class MaintenanceUpdate(BaseModel):
    scheduled_date: date | None = None
    status: str | None = None
    notes: str | None = Field(None, max_length=2000)
    completed_date: date | None = None


def _assert_client_access(client_id: str, user: AdminUser) -> dict:
    row = db.table("clients").select("id,company_id,seller_id,name,phone,email") \
        .eq("id", client_id).single().execute().data
    if not row or row["company_id"] != user.company_id:
        raise HTTPException(404, "Cliente não encontrado")
    if not sees_all_clients(user.role) and row.get("seller_id") != user.user_id:
        raise HTTPException(404, "Cliente não encontrado")
    return row


def _assert_can_manage(user: AdminUser) -> None:
    if user.role not in MAINTENANCE_ROLES:
        raise HTTPException(403, "Perfil sem permissão para gerenciar manutenção")


def _load_maintenance(maintenance_id: str, user: AdminUser) -> dict:
    row = db.table("client_maintenances").select(
        "*,client:clients(id,name,phone,email,seller_id)"
    ).eq("id", maintenance_id).single().execute().data
    if not row or row["company_id"] != user.company_id:
        raise HTTPException(404, "Manutenção não encontrada")
    client = row.get("client") or {}
    if not sees_all_clients(user.role) and client.get("seller_id") != user.user_id:
        raise HTTPException(404, "Manutenção não encontrada")
    return row


@router.get("/maintenance")
def list_maintenances(user: AdminUser = Depends(require_admin)):
    q = db.table("client_maintenances").select(
        "id,client_id,scheduled_date,status,notes,completed_date,created_at,updated_at,"
        "client:clients(id,name,phone,email,seller_id)"
    ).eq("company_id", user.company_id)
    if not sees_all_clients(user.role):
        owned = db.table("clients").select("id") \
            .eq("company_id", user.company_id).eq("seller_id", user.user_id) \
            .execute().data or []
        ids = [c["id"] for c in owned]
        if not ids:
            return []
        q = q.in_("client_id", ids)
    return q.order("scheduled_date", desc=False).execute().data or []


@router.post("/maintenance")
def create_maintenance(payload: MaintenanceIn, user: AdminUser = Depends(require_admin)):
    _assert_can_manage(user)
    _assert_client_access(payload.client_id, user)
    data = {
        "company_id": user.company_id,
        "client_id": payload.client_id,
        "scheduled_date": payload.scheduled_date.isoformat(),
        "notes": payload.notes,
        "created_by": user.user_id,
    }
    r = db.table("client_maintenances").insert(data).execute().data[0]
    log_audit(
        company_id=user.company_id, actor=user,
        action="maintenance.create", entity_type="client_maintenance", entity_id=r["id"],
        metadata={"client_id": payload.client_id, "scheduled_date": data["scheduled_date"]},
    )
    return r


@router.patch("/maintenance/{maintenance_id}")
def update_maintenance(
    maintenance_id: str,
    payload: MaintenanceUpdate,
    user: AdminUser = Depends(require_admin),
):
    _assert_can_manage(user)
    current = _load_maintenance(maintenance_id, user)
    if payload.status and payload.status not in ("scheduled", "completed", "canceled"):
        raise HTTPException(400, "status inválido")
    data = {
        k: (v.isoformat() if hasattr(v, "isoformat") else v)
        for k, v in payload.model_dump(exclude_unset=True).items()
    }
    if not data:
        raise HTTPException(400, "Nada para atualizar")
    data["updated_at"] = datetime.now(UTC).isoformat()
    r = db.table("client_maintenances").update(data).eq("id", maintenance_id).execute().data[0]
    log_audit(
        company_id=user.company_id, actor=user,
        action="maintenance.update", entity_type="client_maintenance", entity_id=maintenance_id,
        metadata={"client_id": current["client_id"], **{k: v for k, v in data.items() if k != "updated_at"}},
    )
    return r


@router.post("/cron/maintenance-check", dependencies=[Depends(require_cron_secret)])
async def maintenance_check(bg: BackgroundTasks):
    """Daily job: installed projects from one year ago trigger phase 14."""
    target = (date.today() - timedelta(days=365)).isoformat()
    projects = db.table("projects").select("id,installed_at") \
        .gte("installed_at", f"{target}T00:00:00") \
        .lte("installed_at", f"{target}T23:59:59") \
        .execute().data or []
    for p in projects:
        bg.add_task(dispatch_phase_notifications, p["id"], 14)
    return {"triggered": len(projects)}


@router.post("/cron/notify-upcoming-installs", dependencies=[Depends(require_cron_secret)])
async def upcoming_installs():
    """Daily job: notify install managers about tomorrow's installs."""
    return await notify_upcoming_installs()
