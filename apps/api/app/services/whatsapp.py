"""WhatsApp via n8n webhook.

A API chama um único endpoint configurável (settings.whatsapp_webhook_url).
O fluxo do n8n recebe `{phone, message}` e cuida do resto (Evolution, Z-API,
Meta, etc) — assim a API não precisa saber qual provider está atrás.
"""

import httpx

from ..config import settings


async def send_whatsapp(phone: str, message: str) -> dict:
    """Envia via webhook n8n. phone só dígitos (ex: 5548999999999)."""
    url = settings.whatsapp_webhook_url
    if not url:
        raise RuntimeError("WhatsApp não configurado: defina WHATSAPP_WEBHOOK_URL")

    headers = {"Content-Type": "application/json"}
    if settings.whatsapp_webhook_secret:
        headers["X-Webhook-Secret"] = settings.whatsapp_webhook_secret

    payload = {"phone": phone, "message": message}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            try:
                return r.json()
            except Exception:
                return {"ok": True, "status_code": r.status_code}
    except httpx.HTTPStatusError as e:
        body = ""
        try:
            body = e.response.text[:300]
        except Exception:
            pass
        raise RuntimeError(f"Webhook WhatsApp {e.response.status_code}: {body}") from e
    except httpx.RequestError as e:
        raise RuntimeError(f"Webhook WhatsApp inacessível ({type(e).__name__}): {e}") from e
