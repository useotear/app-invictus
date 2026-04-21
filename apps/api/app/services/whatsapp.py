import httpx
from ..config import settings


async def send_whatsapp(phone: str, message: str) -> dict:
    """
    Envia mensagem via Evolution API.
    Formato do phone: dígitos (ex: 5548999999999).
    """
    if not settings.whatsapp_base_url or not settings.whatsapp_instance:
        raise RuntimeError("WhatsApp não configurado")

    url = f"{settings.whatsapp_base_url}/message/sendText/{settings.whatsapp_instance}"
    headers = {"apikey": settings.whatsapp_token, "Content-Type": "application/json"}
    payload = {"number": phone, "text": message}

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()
