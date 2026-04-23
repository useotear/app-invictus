from fastapi import APIRouter, Depends, HTTPException
from ..db import db
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


@router.get("/users/sellers")
def list_sellers(user: AdminUser = Depends(require_admin)):
    """Lista vendedores da empresa. Apenas admin pode ver."""
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin")
    return db.table("users") \
        .select("id,name,email,role") \
        .eq("company_id", user.company_id) \
        .order("name").execute().data
