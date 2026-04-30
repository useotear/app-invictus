from datetime import date, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..db import db
from ..deps import AdminUser, log_audit, require_admin
from ..permissions import can_edit_phase
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

    if not can_edit_phase(user.role, phase["phase_number"]):
        raise HTTPException(
            403,
            f"Seu perfil ({user.role}) não tem permissão pra editar esta fase.",
        )

    if payload.status and payload.status not in ("pending", "in_progress", "completed"):
        raise HTTPException(400, "status inválido")

    # Checklist obrigatório de fotos pra concluir a fase 10 (Instalação concluída).
    if payload.status == "completed" and phase["phase_number"] == 10:
        required = {"grid_entry", "inverter", "seal", "panels"}
        labels = {
            "grid_entry": "entrada de rede + plaquinha",
            "inverter": "inversor e micro",
            "seal": "selos do micro e inversor",
            "panels": "painéis solares",
        }
        photos = db.table("project_photos").select("category") \
            .eq("project_id", phase["project_id"]).eq("phase_number", 10).execute().data or []
        have = {p["category"] for p in photos if p.get("category")}
        missing = required - have
        if missing:
            miss_pt = ", ".join(labels[c] for c in sorted(missing))
            raise HTTPException(
                409,
                f"Checklist de fotos incompleto. Faltam: {miss_pt}. "
                "Suba as fotos antes de concluir a instalação.",
            )

    # Regra FIFO: só pode marcar "Instalação concluída" (fase 10) se este projeto
    # for o primeiro da fila de instalação. Respeita a ordem manual definida
    # pelo admin (install_priority) quando preenchida.
    if payload.status == "completed" and phase["phase_number"] == 10:
        from .schedule import _build_queue
        company_id = phase["project"]["company_id"]
        queue = _build_queue(company_id)
        idx = next((i for i, item in enumerate(queue) if item["project_id"] == phase["project_id"]), None)
        if idx is not None and idx > 0:
            raise HTTPException(
                409,
                "Ordem da fila: há instalações na frente desta ainda pendentes. "
                "Conclua as anteriores antes (ou reordene a fila no Cronograma).",
            )

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
    if payload.status in ("completed", "pending"):
        # Recalcula current_phase = menor fase ainda não concluída.
        # Cobre tanto avanço (concluiu uma fase) quanto reabertura (desmarcou).
        all_phases = db.table("project_phases").select("phase_number,status") \
            .eq("project_id", phase["project_id"]).execute().data or []
        # Considera o efeito da própria mudança que ainda não foi gravada se o
        # row em memória não reflete; força via merge.
        for ap in all_phases:
            if ap["phase_number"] == phase["phase_number"]:
                ap["status"] = payload.status
        pending = [p_["phase_number"] for p_ in all_phases if p_["status"] != "completed"]
        new_current = min(pending) if pending else 14
        db.table("projects").update({"current_phase": new_current}) \
            .eq("id", phase["project_id"]).execute()

    if payload.status == "completed":

        # Quando "Kit entregue" (fase 5) é concluído, sugere uma data pra
        # "Instalação agendada" (fase 6) — kit_date + 7 dias.
        # APENAS se a fase 6 ainda não tiver scheduled_date. Se admin já
        # definiu manualmente, respeita — a data manual sempre vence.
        if phase["phase_number"] == 5:
            kit_date = payload.completed_date or date.today()
            sched = db.table("project_phases").select("id,scheduled_date") \
                .eq("project_id", phase["project_id"]).eq("phase_number", 6) \
                .single().execute().data
            if sched and not sched.get("scheduled_date"):
                new_sched = (kit_date + timedelta(days=7)).isoformat()
                db.table("project_phases").update({"scheduled_date": new_sched}) \
                    .eq("id", sched["id"]).execute()

        # Quando "Relógio trocado / Sistema ativo" (fase 12) é concluído,
        # sugere data pro app de monitoramento (fase 13) — meter+7 — mas só
        # se ainda não houver data manual.
        if phase["phase_number"] == 12:
            meter_date = payload.completed_date or date.today()
            app_sched = db.table("project_phases").select("id,scheduled_date") \
                .eq("project_id", phase["project_id"]).eq("phase_number", 13) \
                .single().execute().data
            if app_sched and not app_sched.get("scheduled_date"):
                new_sched = (meter_date + timedelta(days=7)).isoformat()
                db.table("project_phases").update({"scheduled_date": new_sched}) \
                    .eq("id", app_sched["id"]).execute()

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
