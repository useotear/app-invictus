from datetime import UTC

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..deps import AdminUser, log_audit, require_admin
from ..permissions import can_edit_project, can_send_reschedule_notice, sees_all_clients
from ..services.webpush import send_push
from ..services.whatsapp import send_whatsapp

router = APIRouter(prefix="/projects", tags=["projects"])
limiter = Limiter(key_func=get_remote_address)


PAYMENT_METHODS = {"pix", "boleto", "cartao", "transferencia", "financiamento", "outro"}


class ProjectIn(BaseModel):
    client_id: str
    seller_id: str | None = None
    address: str | None = Field(None, max_length=500)
    location_link: str | None = Field(None, max_length=1000)
    installation_notes: str | None = Field(None, max_length=5000)
    system_size_kwp: float | None = Field(None, ge=0, le=10000)
    contract_value: float | None = Field(None, ge=0)
    paid_amount: float = Field(0, ge=0)
    payment_method: str | None = None


class ProjectUpdate(BaseModel):
    address: str | None = Field(None, max_length=500)
    location_link: str | None = Field(None, max_length=1000)
    installation_notes: str | None = Field(None, max_length=5000)
    system_size_kwp: float | None = Field(None, ge=0, le=10000)
    contract_value: float | None = Field(None, ge=0)
    paid_amount: float | None = Field(None, ge=0)
    payment_method: str | None = None
    seller_id: str | None = None


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
    if not sees_all_clients(user.role) and row.get("seller_id") != user.user_id:
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
    if not can_edit_project(user.role):
        raise HTTPException(403, "Perfil sem permissão pra criar projetos")
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
        "id,current_phase,address,location_link,installation_notes,system_size_kwp,contract_value,paid_amount,payment_method,"
        "created_at,updated_at,installed_at,seller_id,"
        "client:clients(id,name,phone,email),"
        "seller:users!projects_seller_id_fkey(id,name)"
    ).eq("company_id", user.company_id)
    if not sees_all_clients(user.role):
        q = q.eq("seller_id", user.user_id)
    return q.order("created_at", desc=True).execute().data


@router.get("/{project_id}")
def get_project(project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_access(project_id, user)
    r = db.table("projects").select(
        "id,current_phase,address,location_link,installation_notes,system_size_kwp,contract_value,paid_amount,payment_method,"
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
    # installation_notes pode ser editado por quem gerencia a obra (admin/scheduler/installer).
    # Outras alterações exigem can_edit_project.
    only_notes = set(payload.model_dump(exclude_none=True).keys()) <= {"installation_notes"}
    allowed_notes_roles = {"admin", "seller", "scheduler", "installer"}
    if only_notes:
        if user.role not in allowed_notes_roles:
            raise HTTPException(403, "Perfil sem permissão")
    elif not can_edit_project(user.role):
        raise HTTPException(403, "Perfil sem permissão pra editar projeto")
    _validate_payment_method(payload.payment_method)
    data = payload.model_dump(exclude_none=True)
    if "seller_id" in data:
        if user.role != "admin":
            data.pop("seller_id")  # vendedor/scheduler não troca dono
        elif data["seller_id"]:
            owner = db.table("users").select("company_id") \
                .eq("id", data["seller_id"]).single().execute().data
            if not owner or owner["company_id"] != user.company_id:
                raise HTTPException(400, "seller_id inválido")
    if not data:
        raise HTTPException(400, "Nada para atualizar")
    r = db.table("projects").update(data).eq("id", project_id).execute()
    return r.data[0]


class RescheduleNoticeIn(BaseModel):
    message: str = Field(..., min_length=5, max_length=1000)
    new_scheduled_date: str | None = None  # YYYY-MM-DD opcional — se passado, atualiza fase 8


@router.post("/{project_id}/reschedule-notice")
@limiter.limit("20/minute")
async def reschedule_notice(
    request: Request, project_id: str,
    payload: RescheduleNoticeIn,
    user: AdminUser = Depends(require_admin),
):
    """Avisa o cliente sobre atraso/reagendamento via WhatsApp + push."""
    if not can_send_reschedule_notice(user.role):
        raise HTTPException(403, "Perfil sem permissão pra enviar aviso")
    project = _assert_project_access(project_id, user)
    client = db.table("clients").select("id,name,phone,access_token,auth_user_id") \
        .eq("id", project["client_id"]).single().execute().data
    if not client:
        raise HTTPException(404, "Cliente não encontrado")

    # Atualiza a data da fase 8 se foi pedido
    if payload.new_scheduled_date:
        db.table("project_phases").update({"scheduled_date": payload.new_scheduled_date}) \
            .eq("project_id", project_id).eq("phase_number", 8).execute()

    masked_phone = f"****{client['phone'][-4:]}" if client.get("phone") and len(client["phone"]) >= 4 else "****"

    # WhatsApp
    wa_ok = False
    wa_err: str | None = None
    try:
        await send_whatsapp(client["phone"], payload.message)
        wa_ok = True
    except Exception as e:
        wa_err = str(e)

    db.table("notifications_log").insert({
        "project_id": project_id,
        "channel": "whatsapp",
        "recipient_type": "client",
        "recipient": masked_phone,
        "message": None,
        "status": "sent" if wa_ok else "failed",
        "error": wa_err,
    }).execute()

    # Push — todas as subscriptions do cliente
    subs = db.table("push_subscriptions").select("*") \
        .eq("client_id", client["id"]).execute().data or []
    push_url = "/cliente" if client.get("auth_user_id") else f"/portal/{client['access_token']}"
    push_sent = 0
    for sub in subs:
        if send_push(sub, title="Invictus Solar", body=payload.message, url=push_url):
            push_sent += 1

    db.table("notifications_log").insert({
        "project_id": project_id,
        "channel": "push",
        "recipient_type": "client",
        "recipient": masked_phone,
        "message": None,
        "status": "sent" if push_sent > 0 else ("failed" if subs else "sent"),
        "error": None if push_sent > 0 or not subs else "nenhuma subscription respondeu",
    }).execute()

    log_audit(
        company_id=user.company_id, actor=user,
        action="project.reschedule_notice", entity_type="project", entity_id=project_id,
        metadata={"push_sent": push_sent, "whatsapp": wa_ok, "new_date": payload.new_scheduled_date},
    )

    return {
        "whatsapp": wa_ok,
        "whatsapp_error": wa_err,
        "push_sent": push_sent,
        "push_subscriptions": len(subs),
    }


@router.get("/by-client-token/{token}")
@limiter.limit("60/minute")
def by_client_token(request: Request, token: str):
    from datetime import datetime
    client = db.table("clients").select("id,name,email,phone,access_token_expires_at") \
        .eq("access_token", token).single().execute().data
    if not client:
        raise HTTPException(404, "Token inválido")
    exp = client.get("access_token_expires_at")
    if exp and datetime.fromisoformat(exp.replace("Z", "+00:00")) < datetime.now(UTC):
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
