from fastapi import APIRouter, Depends

from ..db import db
from ..deps import AdminUser, require_admin

router = APIRouter(prefix="/schedule", tags=["schedule"])

KIT_DELIVERED_PHASE = 4   # "Kit entregue"
SCHEDULED_PHASE = 5       # "Instalação agendada"
INSTALL_DONE_PHASE = 9    # "Instalação concluída"


@router.get("/installations")
def installations_queue(user: AdminUser = Depends(require_admin)):
    """Fila FIFO de instalações pendentes — ordem de chegada do kit.

    Retorna projetos que:
    - Tiveram a fase 4 (Kit entregue) concluída
    - Ainda não passaram pela fase 9 (Instalação concluída)

    Ordenados pela data de conclusão da fase 4 ASC (primeiro a chegar, primeiro a instalar).
    A equipe deve respeitar essa ordem: a UI só libera a marcação do #1.
    """
    # Busca todos os projetos da empresa que estão na janela de instalação
    # Cronograma é geral — todos os perfis veem a agenda completa da empresa.
    projects_q = db.table("projects").select(
        "id,current_phase,address,location_link,installation_notes,system_size_kwp,created_at,seller_id,"
        "client:clients(id,name,phone),"
        "phases:project_phases(phase_number,status,scheduled_date,completed_date)"
    ).eq("company_id", user.company_id).lt("current_phase", INSTALL_DONE_PHASE + 1)

    rows = projects_q.execute().data or []

    queue = []
    for p in rows:
        phases = p.get("phases") or []
        kit_phase = next((ph for ph in phases if ph["phase_number"] == KIT_DELIVERED_PHASE), None)
        install_phase = next((ph for ph in phases if ph["phase_number"] == INSTALL_DONE_PHASE), None)
        scheduled_phase = next((ph for ph in phases if ph["phase_number"] == SCHEDULED_PHASE), None)

        # Só entra na fila quem já recebeu o kit
        kit_arrival = kit_phase and kit_phase.get("completed_date")
        if not kit_arrival:
            continue
        # E ainda não teve a instalação marcada como concluída
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
        })

    # FIFO: menor kit_arrival_date primeiro; empate → created_at
    queue.sort(key=lambda x: (x["kit_arrival_date"], x["project_id"]))
    # Adiciona posição na fila (1-indexed)
    for i, item in enumerate(queue, start=1):
        item["position"] = i

    return queue
