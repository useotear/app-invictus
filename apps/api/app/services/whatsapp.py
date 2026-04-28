import httpx

from ..config import settings


async def send_whatsapp(phone: str, message: str) -> dict:
    """
    Envia mensagem via Evolution API.
    Formato do phone: dígitos (ex: 5548999999999).

    Timeout curto pro proxy do EasyPanel não desistir antes — se o servidor
    Evolution estiver fora, retornamos erro rapidamente em vez de pendurar.
    """
    if not settings.whatsapp_base_url or not settings.whatsapp_instance or not settings.whatsapp_token:
        raise RuntimeError("WhatsApp não configurado: defina WHATSAPP_BASE_URL, WHATSAPP_INSTANCE e WHATSAPP_TOKEN")

    url = f"{settings.whatsapp_base_url.rstrip('/')}/message/sendText/{settings.whatsapp_instance}"
    headers = {"apikey": settings.whatsapp_token, "Content-Type": "application/json"}
    payload = {"number": phone, "text": message}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0)) as client:
            r = await client.post(url, headers=headers, json=payload)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        body = ""
        try:
            body = e.response.text[:300]
        except Exception:
            pass
        raise RuntimeError(f"Evolution {e.response.status_code}: {body}") from e
    except httpx.RequestError as e:
        raise RuntimeError(f"Evolution inacessível ({type(e).__name__}): {e}") from e
