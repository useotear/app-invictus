from pathlib import Path

from pydantic_settings import BaseSettings

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str
    supabase_jwt_secret: str = ""  # Settings → API → JWT Settings → JWT Secret (HS256)

    # WhatsApp via n8n webhook. Override por env WHATSAPP_WEBHOOK_URL se mudar o flow.
    whatsapp_webhook_url: str = "https://n8nwebh.otear.com.br/webhook/envio-app"
    whatsapp_webhook_secret: str = ""  # opcional, vai como header X-Webhook-Secret
    # Legado (Evolution API) — mantido pra compatibilidade, hoje não é usado.
    whatsapp_base_url: str = ""
    whatsapp_instance: str = ""
    whatsapp_token: str = ""

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:contato@invictussolar.com.br"

    # Portal
    portal_base_url: str = "http://localhost:3000"
    allowed_origins: str = "http://localhost:3000"  # CSV

    # Cron
    cron_secret: str = ""
    celesc_secret: str = ""

    # Observability (opcional)
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.0

    class Config:
        env_file = str(ENV_FILE)
        env_file_encoding = "utf-8"


settings = Settings()
