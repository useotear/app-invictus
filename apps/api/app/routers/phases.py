from datetime import date
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from ..db import db
from ..services.notifications import dispatch_phase_notifications

router = APIRouter(prefix="/phases", tags=["phases"])


class PhaseUpdate(BaseModel):
    status: str | None = None  # pending|in_progress|completed
    scheduled_date: date | None = None
    completed_date: date | None = None
    notes: str | None = None
    updated_by: str | None = None


@router.patch("/{phase_id}")
async def update_phase(phase_id: str, payload: PhaseUpdate, bg: BackgroundTasks):
    update = {k: (v.isoformat() if hasattr(v, "isoformat") else v)
              for k, v in payload.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "Nada para atualizar")

    r = db.table("project_phases").update(update).eq("id", phase_id).execute()
    if not r.data:
        raise HTTPException(404)
    phase = r.data[0]

    # Se completou, avança current_phase do projeto e dispara notificações
    if payload.status == "completed":
        if payload.completed_date is None:
            db.table("project_phases").update({"completed_date": date.today().isoformat()}) \
                .eq("id", phase_id).execute()
        next_phase = min(phase["phase_number"] + 1, 12)
        db.table("projects").update({"current_phase": next_phase}) \
            .eq("id", phase["project_id"]).execute()
        bg.add_task(dispatch_phase_notifications, phase["project_id"], phase["phase_number"])

    return phase
