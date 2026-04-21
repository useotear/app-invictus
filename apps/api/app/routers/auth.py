from fastapi import APIRouter, Depends
from ..deps import AdminUser, require_admin

router = APIRouter(tags=["auth"])


@router.get("/whoami")
def whoami(user: AdminUser = Depends(require_admin)):
    """Diagnóstico: valida o JWT e retorna o perfil do admin."""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "company_id": user.company_id,
        "role": user.role,
    }
