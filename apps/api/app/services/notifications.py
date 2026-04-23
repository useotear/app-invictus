from datetime import datetime
from ..config import settings
from ..db import db
from .whatsapp import send_whatsapp
from .webpush import send_push


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
        "*, client:clients(*), seller:users(name,email,phone:email)"
    ).eq("id", project_id).single().execute().data
    if not project:
        return

    client = project["client"]
    seller = project.get("seller")
    company_id = project["company_id"]
    portal_link = f"{settings.portal_base_url}/portal/{client['access_token']}"

    phase = db.table("project_phases").select("*") \
        .eq("project_id", project_id).eq("phase_number", phase_number).single().execute().data
    scheduled = phase.get("scheduled_date") or phase.get("completed_date") or ""

    templates = db.table("notification_templates").select("*") \
        .eq("company_id", company_id).eq("phase_number", phase_number) \
        .eq("event", event).eq("enabled", True).execute().data or []

    for tpl in templates:
        recipients = []
        if tpl["recipient"] in ("client", "both") and client.get("phone"):
            recipients.append(("client", client["phone"], client["name"]))
        if tpl["recipient"] in ("seller", "both") and seller:
            # vendedor recebe por WhatsApp se tiver telefone cadastrado (user.phone não existe no schema — usa email fallback)
            pass

        message = _render(tpl["template"], nome=client["name"],
                          data=str(scheduled), link=portal_link)

        for rtype, phone, _name in recipients:
            # Pseudonimiza: mantém só os últimos 4 dígitos do telefone no log
            # e NÃO grava a mensagem renderizada (contém nome, link com token).
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
                    await send_whatsapp(phone, message)
                elif tpl["channel"] == "push":
                    subs = db.table("push_subscriptions").select("*") \
                        .eq("client_id", client["id"]).execute().data or []
                    for sub in subs:
                        send_push(sub, title="Invictus Solar", body=message, url=f"/portal/{client['access_token']}")
                log["status"] = "sent"
                log["sent_at"] = datetime.utcnow().isoformat()
            except Exception as e:
                log["status"] = "failed"
                log["error"] = str(e)
            db.table("notifications_log").insert(log).execute()
