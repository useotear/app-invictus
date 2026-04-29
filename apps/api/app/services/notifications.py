from datetime import datetime

from ..config import settings
from ..db import db
from .webpush import send_push
from .whatsapp import send_whatsapp


def _render(template: str, *, nome: str, data: str, link: str) -> str:
    return (template
            .replace("{nome}", nome or "")
            .replace("{data}", data or "")
            .replace("{link}", link))


async def dispatch_phase_notifications(
    project_id: str, phase_number: int, event: str = "completed"
) -> None:
    """Busca templates da fase/event e dispara WhatsApp/Push para os destinatários.

    event:
      - 'completed'   → fase concluída (default)
      - 'rescheduled' → data da fase mudou após a conclusão
    """
    project = db.table("projects").select(
        "*, client:clients(*), seller:users!projects_seller_id_fkey(id,name,email,phone)"
    ).eq("id", project_id).single().execute().data
    if not project:
        return

    client = project["client"]
    seller = project.get("seller")
    company_id = project["company_id"]
    portal_link = f"{settings.portal_base_url}/portal/{client['access_token']}"
    admin_link = f"{settings.portal_base_url}/admin/projects/{project_id}"

    phase = db.table("project_phases").select("*") \
        .eq("project_id", project_id).eq("phase_number", phase_number).single().execute().data
    scheduled = phase.get("scheduled_date") or phase.get("completed_date") or ""

    templates = db.table("notification_templates").select("*") \
        .eq("company_id", company_id).eq("phase_number", phase_number) \
        .eq("event", event).eq("enabled", True).execute().data or []

    for tpl in templates:
        # Lista de destinatários sem filtrar por phone — push não precisa de phone.
        # phone pode ser None; a branch de WhatsApp verifica e loga "sem phone" se faltar.
        recipients: list[tuple[str, str | None, str, str]] = []  # (rtype, phone, link, name)
        if tpl["recipient"] in ("client", "both"):
            recipients.append(("client", client.get("phone"), portal_link, client["name"]))
        if tpl["recipient"] in ("seller", "both") and seller:
            recipients.append(("seller", seller.get("phone"), admin_link, seller["name"]))

        for rtype, phone, link, _name in recipients:
            message = _render(tpl["template"], nome=client["name"], data=str(scheduled), link=link)
            masked_phone = f"****{phone[-4:]}" if phone and len(phone) >= 4 else "****"
            log = {
                "project_id": project_id,
                "channel": tpl["channel"],
                "recipient_type": rtype,
                "recipient": masked_phone,
                "message": None,
            }
            try:
                if tpl["channel"] == "whatsapp":
                    if not phone:
                        raise RuntimeError(f"{rtype} sem telefone cadastrado")
                    await send_whatsapp(phone, message)
                elif tpl["channel"] == "push":
                    if rtype == "client":
                        subs = db.table("push_subscriptions").select("*") \
                            .eq("client_id", client["id"]).execute().data or []
                        url = "/cliente" if client.get("auth_user_id") else f"/portal/{client['access_token']}"
                    else:  # seller
                        subs = db.table("push_subscriptions").select("*") \
                            .eq("user_id", seller["id"]).execute().data or []
                        url = f"/admin/projects/{project_id}"
                    if not subs:
                        raise RuntimeError(f"{rtype} sem dispositivo inscrito em push")
                    for sub in subs:
                        send_push(sub, title="Invictus Solar", body=message, url=url)
                log["status"] = "sent"
                log["sent_at"] = datetime.utcnow().isoformat()
            except Exception as e:
                log["status"] = "failed"
                log["error"] = str(e)
            db.table("notifications_log").insert(log).execute()


async def notify_upcoming_installs() -> dict:
    """Chamado por cron diário. Avisa os 'install managers' sobre instalações de amanhã."""
    from datetime import date, timedelta
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    # Projetos com fase 5 agendada pra amanhã e fase 6 ainda não concluída
    phase_rows = db.table("project_phases").select(
        "project_id,scheduled_date,"
        "project:projects!inner(id,current_phase,address,company_id,"
        "client:clients(name,phone))"
    ).eq("phase_number", 5).eq("scheduled_date", tomorrow).execute().data or []

    summary = {"date": tomorrow, "projects": 0, "notified": 0, "errors": []}

    # Agrupa por empresa pra buscar os install_managers uma vez
    by_company: dict[str, list[dict]] = {}
    for row in phase_rows:
        proj = row.get("project")
        if not proj:
            continue
        if proj.get("current_phase", 0) >= 6:
            continue  # instalação já concluída
        by_company.setdefault(proj["company_id"], []).append(proj)

    for company_id, projects in by_company.items():
        summary["projects"] += len(projects)
        managers = db.table("users").select("id,name,phone") \
            .eq("company_id", company_id).eq("is_install_manager", True).execute().data or []
        if not managers:
            continue

        lines = [f"• {p['client']['name']} — {p.get('address') or 'sem endereço'}" for p in projects]
        body = (
            f"Instalações agendadas para amanhã ({tomorrow}):\n\n"
            + "\n".join(lines)
            + "\n\nConfira o cronograma no painel."
        )

        for m in managers:
            if m.get("phone"):
                try:
                    await send_whatsapp(m["phone"], body)
                    summary["notified"] += 1
                except Exception as e:
                    summary["errors"].append({"user": m["id"], "channel": "whatsapp", "error": str(e)})

            # push
            subs = db.table("push_subscriptions").select("*") \
                .eq("user_id", m["id"]).execute().data or []
            for sub in subs:
                send_push(sub, title="Instalações de amanhã",
                          body=f"{len(projects)} instalação(ões) agendada(s) pra {tomorrow}",
                          url="/admin/cronograma")

    return summary
