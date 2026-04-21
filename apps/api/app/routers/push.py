from fastapi import APIRouter
from pydantic import BaseModel
from ..db import db
from ..config import settings

router = APIRouter(prefix="/push", tags=["push"])


class SubscribeIn(BaseModel):
    client_token: str | None = None
    user_id: str | None = None
    endpoint: str
    p256dh: str
    auth: str


@router.get("/vapid-public-key")
def vapid_public_key():
    return {"key": settings.vapid_public_key}


@router.post("/subscribe")
def subscribe(payload: SubscribeIn):
    client_id = None
    if payload.client_token:
        c = db.table("clients").select("id").eq("access_token", payload.client_token) \
            .single().execute().data
        if c:
            client_id = c["id"]
    row = {
        "client_id": client_id,
        "user_id": payload.user_id,
        "endpoint": payload.endpoint,
        "p256dh": payload.p256dh,
        "auth": payload.auth,
    }
    db.table("push_subscriptions").upsert(row, on_conflict="endpoint").execute()
    return {"ok": True}
