from fastapi import APIRouter, Depends, HTTPException

from ..db import db
from ..deps import AdminUser, require_admin

router = APIRouter(prefix="/schedule", tags=["schedule"])

KIT_DELIVERED_PHASE = 4   # "Kit entregue"
SCHEDULED_PHASE = 5       # "Instalação agendada"
INSTALL_DONE_PHASE = 9    # "Instalação concluída"


def _build_queue(company_id: str) -> list[dict]:
    """Monta a fila ordenada. Compartilhado por GET e pelos endpoints de reorder."""
    rows = db.table("projects").select(
        "id,current_phase,address,location_link,installation_notes,system_size_kwp,"
        "created_at,seller_id,install_priority,"
        "client:clients(id,name,phone),"
        "phases:project_phases(phase_number,status,scheduled_date,completed_date)"
    ).eq("company_id", company_id).lt("current_phase", INSTALL_DONE_PHASE + 1).execute().data or []

    queue = []
    for p in rows:
        phases = p.get("phases") or []
        kit_phase = next((ph for ph in phases if ph["phase_number"] == KIT_DELIVERED_PHASE), None)
        install_phase = next((ph for ph in phases if ph["phase_number"] == INSTALL_DONE_PHASE), None)
        scheduled_phase = next((ph for ph in phases if ph["phase_number"] == SCHEDULED_PHASE), None)

        kit_arrival = kit_phase and kit_phase.get("completed_date")
        if not kit_arrival:
            continue
        if install_phase and install_phase.get("status") == "completed":
            continue

        queue.append({
            "project_id": p["id"],
            "client": p["client"],
            "address": p.get("address"),
            "location_link": p.get("location_link"),
            "installation_notes": p.get("installation_notes"),
            "system_size_kwp": p.get("system_size_kwp"),
            "current_phase": p["current_phase"],
            "kit_arrival_date": kit_arrival,
            "install_scheduled_date": scheduled_phase and scheduled_phase.get("scheduled_date"),
            "install_status": install_phase.get("status") if install_phase else "pending",
            "install_priority": p.get("install_priority"),
        })

    # Ordem: install_priority ASC (com NULLS LAST), depois kit_arrival_date ASC, empate por id.
    # Em Python: usar tuplas — None vira (1, 0) pra cair depois de (0, valor).
    queue.sort(key=lambda x: (
        (1, 0) if x["install_priority"] is None else (0, x["install_priority"]),
        x["kit_arrival_date"],
        x["project_id"],
    ))
    for i, item in enumerate(queue, start=1):
        item["position"] = i
    return queue


@router.get("/installations")
def installations_queue(user: AdminUser = Depends(require_admin)):
    """Fila FIFO de instalações pendentes — ordem de chegada do kit, com override manual.

    Admin pode reordenar via POST /installations/{id}/move-up|move-down.
    """
    return _build_queue(user.company_id)


def _swap(company_id: str, project_id: str, direction: str) -> dict:
    if direction not in ("up", "down"):
        raise HTTPException(400, "direction deve ser 'up' ou 'down'")
    queue = _build_queue(company_id)
    idx = next((i for i, item in enumerate(queue) if item["project_id"] == project_id), None)
    if idx is None:
        raise HTTPException(404, "Projeto não está na fila")
    if direction == "up" and idx == 0:
        return {"moved": False, "reason": "Já é o primeiro"}
    if direction == "down" and idx == len(queue) - 1:
        return {"moved": False, "reason": "Já é o último"}

    new_order = list(queue)
    target = idx - 1 if direction == "up" else idx + 1
    new_order[idx], new_order[target] = new_order[target], new_order[idx]
    for pos, item in enumerate(new_order, start=1):
        db.table("projects").update({"install_priority": pos}) \
            .eq("id", item["project_id"]).execute()
    return {"moved": True}


@router.post("/installations/{project_id}/move-up")
def move_up(project_id: str, user: AdminUser = Depends(require_admin)):
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin pode reordenar a fila")
    return _swap(user.company_id, project_id, "up")


@router.post("/installations/{project_id}/move-down")
def move_down(project_id: str, user: AdminUser = Depends(require_admin)):
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin pode reordenar a fila")
    return _swap(user.company_id, project_id, "down")
