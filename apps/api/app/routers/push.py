from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..config import settings
from ..db import db
from ..deps import AdminUser, require_admin
from ..services.webpush import send_push

router = APIRouter(prefix="/push", tags=["push"])
limiter = Limiter(key_func=get_remote_address)


class SubscribeIn(BaseModel):
    client_token: str | None = Field(None, min_length=16, max_length=128)
    endpoint: str = Field(..., min_length=10, max_length=2048)
    p256dh: str = Field(..., max_length=256)
    auth: str = Field(..., max_length=64)


@router.get("/vapid-public-key")
@limiter.limit("60/minute")
def vapid_public_key(request: Request):
    return {"key": settings.vapid_public_key}


@router.post("/subscribe")
@limiter.limit("10/minute")
def subscribe(request: Request, payload: SubscribeIn):
    client_id = None
    if payload.client_token:
        c = db.table("clients").select("id").eq("access_token", payload.client_token) \
            .single().execute().data
        if c:
            client_id = c["id"]
    if not client_id:
        return {"ok": False}
    row = {
        "client_id": client_id,
        "endpoint": payload.endpoint,
        "p256dh": payload.p256dh,
        "auth": payload.auth,
    }
    db.table("push_subscriptions").upsert(row, on_conflict="endpoint").execute()
    return {"ok": True}


class UserSubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=10, max_length=2048)
    p256dh: str = Field(..., max_length=256)
    auth: str = Field(..., max_length=64)


@router.post("/subscribe-user")
@limiter.limit("20/minute")
def subscribe_user(request: Request, payload: UserSubscribeIn, user: AdminUser = Depends(require_admin)):
    """Inscreve o usuário (admin/vendedor/etc) pra receber push do app admin."""
    db.table("push_subscriptions").upsert({
        "user_id": user.user_id,
        "endpoint": payload.endpoint,
        "p256dh": payload.p256dh,
        "auth": payload.auth,
    }, on_conflict="endpoint").execute()
    return {"ok": True}


class TestPushIn(BaseModel):
    client_id: str | None = None
    user_id: str | None = None
    title: str = Field("Invictus Solar — teste", max_length=120)
    body: str = Field("Notificação de teste do painel.", max_length=300)
    url: str = Field("/cliente", max_length=200)


@router.post("/test")
def test_push(payload: TestPushIn, user: AdminUser = Depends(require_admin)):
    """Dispara push de teste pra um cliente, usuário, ou pro próprio admin (default)."""
    target_user_id = payload.user_id or user.user_id
    if payload.client_id:
        c = db.table("clients").select("id,company_id") \
            .eq("id", payload.client_id).single().execute().data
        if not c or c["company_id"] != user.company_id:
            raise HTTPException(404, "Cliente não encontrado")
        subs = db.table("push_subscriptions").select("*") \
            .eq("client_id", payload.client_id).execute().data or []
        scope = f"client {payload.client_id}"
    else:
        if payload.user_id and payload.user_id != user.user_id:
            target = db.table("users").select("company_id") \
                .eq("id", payload.user_id).single().execute().data
            if not target or target["company_id"] != user.company_id:
                raise HTTPException(404, "Usuário não encontrado")
        subs = db.table("push_subscriptions").select("*") \
            .eq("user_id", target_user_id).execute().data or []
        scope = f"user {target_user_id}"

    if not subs:
        return {
            "ok": False,
            "scope": scope,
            "reason": "Nenhuma push subscription encontrada. O destinatário precisa ter aberto o app e aceitado notificações pelo menos uma vez.",
        }

    sent = 0
    failed = 0
    errors: list[str] = []
    for sub in subs:
        try:
            ok = send_push(sub, title=payload.title, body=payload.body, url=payload.url)
            if ok:
                sent += 1
            else:
                failed += 1
        except Exception as e:
            failed += 1
            errors.append(str(e)[:200])

    return {
        "ok": sent > 0,
        "scope": scope,
        "subscriptions": len(subs),
        "sent": sent,
        "failed": failed,
        "errors": errors[:5],
    }
