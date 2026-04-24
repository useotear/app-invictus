from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from ..db import db
from ..deps import AdminUser, require_admin

router = APIRouter(tags=["auth"])


@router.get("/whoami")
def whoami(user: AdminUser = Depends(require_admin)):
    """Diagnóstico: valida o JWT e retorna o perfil do admin."""
    row = db.table("users").select("phone,is_install_manager") \
        .eq("id", user.user_id).single().execute().data or {}
    return {
        "user_id": user.user_id,
        "email": user.email,
        "company_id": user.company_id,
        "role": user.role,
        "phone": row.get("phone"),
        "is_install_manager": row.get("is_install_manager", False),
    }


class ProfileIn(BaseModel):
    phone: str | None = Field(None, pattern=r"^\d{10,13}$|^$")


@router.patch("/users/me")
def update_my_profile(payload: ProfileIn, user: AdminUser = Depends(require_admin)):
    """Atualiza o próprio telefone (pra WhatsApp de notificações)."""
    db.table("users").update({"phone": payload.phone or None}) \
        .eq("id", user.user_id).execute()
    return {"ok": True}


@router.get("/users/sellers")
def list_sellers(user: AdminUser = Depends(require_admin)):
    """Lista vendedores da empresa. Apenas admin pode ver."""
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin")
    return db.table("users") \
        .select("id,name,email,role") \
        .eq("company_id", user.company_id) \
        .order("name").execute().data


@router.get("/users/team")
def list_team(user: AdminUser = Depends(require_admin)):
    """Time da empresa (admin + sellers) com phone e flag install_manager. Só admin."""
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin")
    return db.table("users") \
        .select("id,name,email,role,phone,is_install_manager") \
        .eq("company_id", user.company_id) \
        .order("name").execute().data


VALID_ROLES = ("admin", "seller", "homologation", "installer", "scheduler")


class TeamMemberUpdate(BaseModel):
    is_install_manager: bool | None = None
    phone: str | None = Field(None, pattern=r"^\d{10,13}$|^$")
    role: str | None = None


@router.patch("/users/{user_id}")
def update_team_member(
    user_id: str, payload: TeamMemberUpdate,
    user: AdminUser = Depends(require_admin),
):
    """Admin edita membros do time (role, flag install_manager, phone)."""
    if user.role != "admin":
        raise HTTPException(403, "Apenas admin")
    target = db.table("users").select("company_id") \
        .eq("id", user_id).single().execute().data
    if not target or target["company_id"] != user.company_id:
        raise HTTPException(404, "Usuário não encontrado")

    update = payload.model_dump(exclude_none=True)
    if "phone" in update:
        update["phone"] = update["phone"] or None
    if "role" in update and update["role"] not in VALID_ROLES:
        raise HTTPException(400, f"role inválido. Use: {VALID_ROLES}")
    if not update:
        raise HTTPException(400, "Nada para atualizar")
    db.table("users").update(update).eq("id", user_id).execute()
    return {"ok": True}
