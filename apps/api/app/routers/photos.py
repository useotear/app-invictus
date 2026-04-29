"""Upload/list/delete de fotos de instalação via Supabase Storage."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..db import db
from ..deps import AdminUser, log_audit, require_admin
from ..permissions import can_upload_install_photo, sees_all_clients

router = APIRouter(prefix="/projects/{project_id}/photos", tags=["photos"])

BUCKET = "project-photos"

# Só aceitamos imagens.
MIME_MAGIC: dict[str, list[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
    "image/heic": [b"\x00\x00\x00"],  # HEIC headers variam; só permitimos se browser converter
}
MAX_BYTES = 15 * 1024 * 1024  # 15 MB

REQUIRED_CATEGORIES = {"grid_entry", "inverter", "seal", "panels"}
ALL_CATEGORIES = REQUIRED_CATEGORIES | {"other"}


def _validate_magic(content: bytes, declared_mime: str) -> bool:
    sigs = MIME_MAGIC.get(declared_mime)
    if not sigs:
        return False
    if declared_mime == "image/heic":
        # Aceita qualquer, browser geralmente converte — validação fraca, só checamos tamanho.
        return True
    if not any(content.startswith(s) for s in sigs):
        return False
    if declared_mime == "image/webp" and (len(content) < 12 or content[8:12] != b"WEBP"):
        return False
    return True


def _safe_name(raw: str | None) -> str:
    name = raw or "foto"
    cleaned = "".join(c for c in name if c.isprintable() and c not in "/\\\x00")
    cleaned = cleaned.replace("..", "_")
    return (cleaned.strip() or "foto")[:120]


def _assert_project_access(project_id: str, user: AdminUser) -> None:
    row = db.table("projects").select("company_id,seller_id") \
        .eq("id", project_id).single().execute().data
    if not row or row["company_id"] != user.company_id:
        raise HTTPException(404, "Projeto não encontrado")
    if not sees_all_clients(user.role) and row.get("seller_id") != user.user_id:
        raise HTTPException(404, "Projeto não encontrado")


@router.post("")
async def upload_photo(
    project_id: str,
    file: UploadFile = File(...),
    category: str = Form(..., max_length=30),
    phase_number: int = Form(9, ge=1, le=13),
    user: AdminUser = Depends(require_admin),
):
    _assert_project_access(project_id, user)

    if not can_upload_install_photo(user.role):
        raise HTTPException(403, "Perfil sem permissão pra anexar fotos da instalação")

    if category not in ALL_CATEGORIES:
        raise HTTPException(400, f"Categoria inválida. Use: {sorted(ALL_CATEGORIES)}")

    if file.content_type not in MIME_MAGIC:
        raise HTTPException(400, f"Tipo não permitido: {file.content_type}")

    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(413, f"Arquivo maior que {MAX_BYTES // (1024*1024)}MB")

    if not _validate_magic(content, file.content_type):
        raise HTTPException(400, "Conteúdo do arquivo não corresponde ao tipo declarado")

    import time
    ts = int(time.time() * 1000)
    safe = _safe_name(file.filename)
    path = f"{project_id}/{phase_number}/{category}/{ts}_{safe}"

    db.storage.from_(BUCKET).upload(
        path=path,
        file=content,
        file_options={"content-type": file.content_type, "upsert": "true"},
    )

    row = db.table("project_photos").insert({
        "project_id": project_id,
        "phase_number": phase_number,
        "category": category,
        "photo_url": path,
        "uploaded_by": user.user_id,
    }).execute().data[0]

    log_audit(
        company_id=user.company_id, actor=user,
        action="photo.upload", entity_type="project_photo", entity_id=row["id"],
        metadata={"project_id": project_id, "category": category, "phase": phase_number},
    )
    return row


@router.get("")
def list_photos(project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_access(project_id, user)
    return db.table("project_photos").select("*") \
        .eq("project_id", project_id).order("created_at", desc=True).execute().data


@router.get("/{photo_id}/signed-url")
def signed_url(photo_id: str, project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_access(project_id, user)
    ph = db.table("project_photos").select("*") \
        .eq("id", photo_id).eq("project_id", project_id).single().execute().data
    if not ph:
        raise HTTPException(404)
    res = db.storage.from_(BUCKET).create_signed_url(ph["photo_url"], expires_in=300)
    return {"url": res.get("signedURL") or res.get("signedUrl")}


@router.delete("/{photo_id}")
def delete_photo(photo_id: str, project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_access(project_id, user)
    if not can_upload_install_photo(user.role):
        raise HTTPException(403, "Perfil sem permissão")
    ph = db.table("project_photos").select("*") \
        .eq("id", photo_id).eq("project_id", project_id).single().execute().data
    if not ph:
        raise HTTPException(404)
    db.storage.from_(BUCKET).remove([ph["photo_url"]])
    db.table("project_photos").delete().eq("id", photo_id).execute()
    log_audit(
        company_id=user.company_id, actor=user,
        action="photo.delete", entity_type="project_photo", entity_id=photo_id,
    )
    return {"ok": True}


@router.get("/checklist")
def checklist(project_id: str, user: AdminUser = Depends(require_admin)):
    """Retorna {category: count} das fotos da fase 9 + flag complete."""
    _assert_project_access(project_id, user)
    rows = db.table("project_photos").select("category") \
        .eq("project_id", project_id).eq("phase_number", 9).execute().data or []
    counts: dict[str, int] = {c: 0 for c in REQUIRED_CATEGORIES}
    for r in rows:
        c = r.get("category")
        if c in REQUIRED_CATEGORIES:
            counts[c] += 1
    missing = [c for c, n in counts.items() if n == 0]
    return {"counts": counts, "missing": missing, "complete": len(missing) == 0}
