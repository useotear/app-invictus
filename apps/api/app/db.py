from supabase import create_client, Client
from .config import settings


def get_admin_client() -> Client:
    """Service-role client. Bypassa RLS — usar apenas no backend."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


db: Client = get_admin_client()
