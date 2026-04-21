"""Cron job: dispara lembrete de manutenção 1 ano após instalação."""
from datetime import date, timedelta
from fastapi import APIRouter, BackgroundTasks
from ..db import db
from ..services.notifications import dispatch_phase_notifications

router = APIRouter(prefix="/cron", tags=["cron"])


@router.post("/maintenance-check")
async def maintenance_check(bg: BackgroundTasks):
    """Roda diário. Projetos instalados há exatamente 1 ano → fase 12."""
    target = (date.today() - timedelta(days=365)).isoformat()
    projects = db.table("projects").select("id,installed_at") \
        .gte("installed_at", f"{target}T00:00:00") \
        .lte("installed_at", f"{target}T23:59:59") \
        .execute().data or []
    for p in projects:
        bg.add_task(dispatch_phase_notifications, p["id"], 12)
    return {"triggered": len(projects)}
