from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..deps import ClientUser, require_client

router = APIRouter(prefix="/me", tags=["me"])
limiter = Limiter(key_func=get_remote_address)


@router.get("")
def whoami(me: ClientUser = Depends(require_client)):
    c = db.table("clients").select("id,name,email,phone,must_change_password") \
        .eq("id", me.client_id).single().execute().data
    return c


@router.get("/projects")
def list_projects(me: ClientUser = Depends(require_client)):
    projects = db.table("projects").select(
        "id,current_phase,address,system_size_kwp,contract_value,paid_amount,"
        "payment_method,created_at,installed_at,"
        "phases:project_phases(*),"
        "documents:project_documents(id,name,created_at)"
    ).eq("client_id", me.client_id).execute().data or []
    for p in projects:
        p["phases"] = sorted(p.get("phases") or [], key=lambda x: x["phase_number"])
        p["documents_count"] = len(p.get("documents") or [])
    return projects


@router.get("/projects/{project_id}")
def get_project(project_id: str, me: ClientUser = Depends(require_client)):
    r = db.table("projects").select(
        "id,current_phase,address,system_size_kwp,contract_value,paid_amount,"
        "payment_method,created_at,installed_at,client_id,"
        "phases:project_phases(*),"
        "documents:project_documents(id,name,file_url,created_at)"
    ).eq("id", project_id).single().execute().data
    if not r or r["client_id"] != me.client_id:
        raise HTTPException(404)
    r["phases"] = sorted(r.get("phases") or [], key=lambda p: p["phase_number"])
    return r


class PushSubscriptionIn(BaseModel):
    endpoint: str = Field(..., max_length=2000)
    p256dh: str = Field(..., max_length=500)
    auth: str = Field(..., max_length=500)


@router.post("/push/subscribe")
@limiter.limit("20/minute")
def push_subscribe(
    request: Request, payload: PushSubscriptionIn,
    me: ClientUser = Depends(require_client),
):
    db.table("push_subscriptions").upsert(
        {
            "client_id": me.client_id,
            "endpoint": payload.endpoint,
            "p256dh": payload.p256dh,
            "auth": payload.auth,
        },
        on_conflict="endpoint",
    ).execute()
    return {"ok": True}


@router.post("/push/unsubscribe")
def push_unsubscribe(
    payload: PushSubscriptionIn,
    me: ClientUser = Depends(require_client),
):
    db.table("push_subscriptions") \
        .delete() \
        .eq("client_id", me.client_id) \
        .eq("endpoint", payload.endpoint) \
        .execute()
    return {"ok": True}


class ChangePasswordIn(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=72)


@router.post("/change-password")
@limiter.limit("5/minute")
def change_password(
    request: Request, payload: ChangePasswordIn,
    me: ClientUser = Depends(require_client),
):
    try:
        db.auth.admin.update_user_by_id(me.user_id, {"password": payload.new_password})
    except Exception as e:
        raise HTTPException(502, f"Falha ao trocar senha: {e}")
    db.table("clients").update({"must_change_password": False}).eq("id", me.client_id).execute()
    return {"ok": True}
