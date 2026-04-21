from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..config import settings

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
