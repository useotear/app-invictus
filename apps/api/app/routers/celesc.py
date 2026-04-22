"""Integração com scraper da Celesc: import em lote + webhook de atualização."""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..db import db

router = APIRouter(prefix="/celesc", tags=["celesc"])


def require_celesc_secret(x_celesc_secret: Annotated[str | None, Header()] = None) -> None:
    expected = settings.celesc_secret or settings.cron_secret
    if not expected:
        raise HTTPException(500, "CELESC_SECRET não configurado")
    if not x_celesc_secret or x_celesc_secret != expected:
        raise HTTPException(401, "Celesc secret inválido")


class CelescClient(BaseModel):
    name: str | None = None
    cpf_cnpj: str | None = None
    phone_mobile: str | None = None
    phone_fixed: str | None = None
    email: str | None = None


class CelescProtocol(BaseModel):
    protocol: str
    address: str | None = None
    client: CelescClient | None = None
    invictus_phase: int  # 5, 6, 7 (ou 11 se execução)


class ImportPayload(BaseModel):
    company_id: str
    items: list[CelescProtocol]


def _norm_phone(p: str | None) -> str | None:
    if not p:
        return None
    digits = "".join(c for c in p if c.isdigit())
    if len(digits) < 10:
        return None
    if not digits.startswith("55"):
        digits = "55" + digits
    return digits


def _norm_doc(d: str | None) -> str | None:
    if not d:
        return None
    return "".join(c for c in d if c.isdigit()) or None


def _advance_project_phases(project_id: str, target_phase: int) -> None:
    """Marca fases 1..target_phase-1 como concluídas e a target_phase como in_progress,
    sem disparar notificações."""
    today = date.today().isoformat()
    db.table("project_phases") \
        .update({"status": "completed", "completed_date": today}) \
        .eq("project_id", project_id) \
        .lt("phase_number", target_phase) \
        .execute()
    db.table("project_phases") \
        .update({"status": "in_progress"}) \
        .eq("project_id", project_id) \
        .eq("phase_number", target_phase) \
        .execute()
    db.table("projects") \
        .update({"current_phase": target_phase}) \
        .eq("id", project_id).execute()


@router.post("/import", dependencies=[Depends(require_celesc_secret)])
def import_snapshot(payload: ImportPayload):
    """Cria clientes e projetos no Invictus a partir de snapshot da Celesc.
    Idempotente: pula protocolos já existentes e reusa clientes pelo CPF/CNPJ."""
    import secrets as _secrets

    created_clients = 0
    created_projects = 0
    skipped = 0
    errors: list[dict] = []

    for item in payload.items:
        try:
            if not item.client or not item.client.cpf_cnpj or not item.client.name:
                skipped += 1
                errors.append({"protocol": item.protocol, "reason": "sem dados do cliente"})
                continue

            existing = db.table("projects").select("id") \
                .eq("celesc_protocol", item.protocol).execute().data or []
            if existing:
                skipped += 1
                continue

            cpf = _norm_doc(item.client.cpf_cnpj)
            phone = _norm_phone(item.client.phone_mobile or item.client.phone_fixed)

            client_rows = []
            if cpf:
                client_rows = db.table("clients").select("id") \
                    .eq("company_id", payload.company_id).eq("cpf_cnpj", cpf) \
                    .limit(1).execute().data or []

            if client_rows:
                client_id = client_rows[0]["id"]
            else:
                client_data = {
                    "company_id": payload.company_id,
                    "name": item.client.name,
                    "phone": phone or "0000000000",
                    "email": item.client.email,
                    "cpf_cnpj": cpf,
                    "access_token": _secrets.token_urlsafe(24),
                }
                r = db.table("clients").insert(client_data).execute()
                client_id = r.data[0]["id"]
                created_clients += 1

            project_data = {
                "company_id": payload.company_id,
                "client_id": client_id,
                "address": item.address,
                "celesc_protocol": item.protocol,
            }
            proj = db.table("projects").insert(project_data).execute().data[0]
            created_projects += 1

            if item.invictus_phase and 1 < item.invictus_phase <= 12:
                _advance_project_phases(proj["id"], item.invictus_phase)
        except Exception as e:
            errors.append({"protocol": item.protocol, "error": str(e)})

    return {
        "created_clients": created_clients,
        "created_projects": created_projects,
        "skipped": skipped,
        "errors": errors,
    }


class CelescSyncPhase(BaseModel):
    protocol: str
    invictus_phase: int


@router.post("/sync-phases", dependencies=[Depends(require_celesc_secret)])
def sync_phases(items: list[CelescSyncPhase]):
    """Atualiza fase de projetos que já têm celesc_protocol (uso diário/cron)."""
    updated = 0
    not_found: list[str] = []
    for it in items:
        p = db.table("projects").select("id,current_phase") \
            .eq("celesc_protocol", it.protocol).limit(1).execute().data or []
        if not p:
            not_found.append(it.protocol)
            continue
        current = p[0]["current_phase"] or 1
        if it.invictus_phase > current:
            _advance_project_phases(p[0]["id"], it.invictus_phase)
            updated += 1
    return {"updated": updated, "not_found": not_found}
