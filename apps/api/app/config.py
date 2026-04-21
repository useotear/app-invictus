from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_anon_key: str

    # WhatsApp (Evolution API por padrão; trocar base_url para Z-API se preferido)
    whatsapp_base_url: str = ""
    whatsapp_instance: str = ""
    whatsapp_token: str = ""

    # Web Push (VAPID)
    vapid_public_key: str = ""
    vapid_private_key: str = ""
    vapid_subject: str = "mailto:contato@invictussolar.com.br"

    # Portal
    portal_base_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
