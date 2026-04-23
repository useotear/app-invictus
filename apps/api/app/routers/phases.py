from datetime import date
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..deps import AdminUser, log_audit, require_admin
from ..services.notifications import dispatch_phase_notifications

router = APIRouter(prefix="/phases", tags=["phases"])
limiter = Limiter(key_func=get_remote_address)


class PhaseUpdate(BaseModel):
    status: str | None = None  # pending|in_progress|completed
    scheduled_date: date | None = None
    completed_date: date | None = None
    notes: str | None = None


@router.patch("/{phase_id}")
@limiter.limit("60/minute")
async def update_phase(
    request: Request,
    phase_id: str,
    payload: PhaseUpdate,
    bg: BackgroundTasks,
    user: AdminUser = Depends(require_admin),
):
    phase = db.table("project_phases").select("*,project:projects(company_id,seller_id)") \
        .eq("id", phase_id).single().execute().data
    if not phase or phase["project"]["company_id"] != user.company_id:
        raise HTTPException(404)
    if user.role == "seller" and phase["project"].get("seller_id") != user.user_id:
        raise HTTPException(404)

    if payload.status and payload.status not in ("pending", "in_progress", "completed"):
        raise HTTPException(400, "status inválido")

    update = {k: (v.isoformat() if hasattr(v, "isoformat") else v)
              for k, v in payload.model_dump(exclude_none=True).items()}
    if not update:
        raise HTTPException(400, "Nada para atualizar")

    update["updated_by"] = user.user_id

    r = db.table("project_phases").update(update).eq("id", phase_id).execute()
    if not r.data:
        raise HTTPException(404)
    updated = r.data[0]

    was_completed = phase["status"] == "completed"
    old_scheduled = phase.get("scheduled_date")
    new_scheduled = update.get("scheduled_date")

    if payload.status == "completed":
        if payload.completed_date is None:
            db.table("project_phases").update({"completed_date": date.today().isoformat()}) \
                .eq("id", phase_id).execute()
        next_phase = min(phase["phase_number"] + 1, 12)
        db.table("projects").update({"current_phase": next_phase}) \
            .eq("id", phase["project_id"]).execute()
        bg.add_task(
            dispatch_phase_notifications,
            phase["project_id"], phase["phase_number"], "completed",
        )
    elif (
        was_completed
        and new_scheduled
        and new_scheduled != old_scheduled
    ):
        # Reagendamento: fase já concluída teve a data alterada.
        bg.add_task(
            dispatch_phase_notifications,
            phase["project_id"], phase["phase_number"], "rescheduled",
        )

    log_audit(
        company_id=user.company_id, actor=user,
        action="phase.update", entity_type="project_phase", entity_id=phase_id,
        metadata={
            "project_id": phase["project_id"],
            "phase_number": phase["phase_number"],
            **{k: v for k, v in update.items() if k != "updated_by"},
        },
    )

    return updated
