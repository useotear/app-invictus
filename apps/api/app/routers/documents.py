"""Upload/list/delete de documentos de projeto via Supabase Storage."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..db import db
from ..deps import AdminUser, log_audit, require_admin

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])

BUCKET = "project-documents"

# Magic bytes (primeiros bytes do arquivo) por tipo declarado.
# Fonte: https://www.garykessler.net/library/file_sigs.html
MIME_MAGIC: dict[str, list[bytes]] = {
    "application/pdf": [b"%PDF-"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/webp": [b"RIFF"],  # + WEBP em offset 8, checado abaixo
    "application/msword": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],  # OLE (DOC legado)
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [b"PK\x03\x04"],  # ZIP (DOCX)
}
MAX_BYTES = 15 * 1024 * 1024  # 15 MB


def _validate_magic(content: bytes, declared_mime: str) -> bool:
    sigs = MIME_MAGIC.get(declared_mime)
    if not sigs:
        return False
    if not any(content.startswith(s) for s in sigs):
        return False
    # WebP precisa checar "WEBP" no offset 8
    if declared_mime == "image/webp" and (len(content) < 12 or content[8:12] != b"WEBP"):
        return False
    return True


def _safe_filename(raw: str | None) -> str:
    name = raw or "arquivo"
    # Remove path separators e caracteres de controle; trunca.
    cleaned = "".join(c for c in name if c.isprintable() and c not in "/\\\x00")
    cleaned = cleaned.replace("..", "_")
    return (cleaned.strip() or "arquivo")[:120]


def _assert_project_in_company(project_id: str, company_id: str) -> None:
    row = db.table("projects").select("company_id").eq("id", project_id).single().execute().data
    if not row or row["company_id"] != company_id:
        raise HTTPException(404, "Projeto não encontrado")


@router.post("")
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    label: str | None = Form(None, max_length=200),
    user: AdminUser = Depends(require_admin),
):
    _assert_project_in_company(project_id, user.company_id)

    if file.content_type not in MIME_MAGIC:
        raise HTTPException(400, f"Tipo não permitido: {file.content_type}")

    # Lê com limite para evitar OOM em arquivos enormes
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(413, f"Arquivo maior que {MAX_BYTES // (1024*1024)}MB")

    if not _validate_magic(content, file.content_type):
        raise HTTPException(400, "Conteúdo do arquivo não corresponde ao tipo declarado")

    safe_name = _safe_filename(file.filename)
    path = f"{project_id}/{safe_name}"

    storage = db.storage.from_(BUCKET)
    storage.upload(
        path=path,
        file=content,
        file_options={"content-type": file.content_type, "upsert": "true"},
    )

    row = db.table("project_documents").insert({
        "project_id": project_id,
        "name": _safe_filename(label) if label else safe_name,
        "file_url": path,
        "uploaded_by": user.user_id,
    }).execute().data[0]

    log_audit(
        company_id=user.company_id, actor=user,
        action="doc.upload", entity_type="project_document", entity_id=row["id"],
        metadata={"project_id": project_id, "mime": file.content_type, "size": len(content)},
    )
    return row


@router.get("")
def list_documents(project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_in_company(project_id, user.company_id)
    return db.table("project_documents").select("*") \
        .eq("project_id", project_id).order("created_at", desc=True).execute().data


@router.get("/{doc_id}/signed-url")
def signed_url(doc_id: str, project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_in_company(project_id, user.company_id)
    doc = db.table("project_documents").select("*") \
        .eq("id", doc_id).eq("project_id", project_id).single().execute().data
    if not doc:
        raise HTTPException(404)
    res = db.storage.from_(BUCKET).create_signed_url(doc["file_url"], expires_in=300)
    return {"url": res.get("signedURL") or res.get("signedUrl")}


@router.delete("/{doc_id}")
def delete_document(doc_id: str, project_id: str, user: AdminUser = Depends(require_admin)):
    _assert_project_in_company(project_id, user.company_id)
    doc = db.table("project_documents").select("*") \
        .eq("id", doc_id).eq("project_id", project_id).single().execute().data
    if not doc:
        raise HTTPException(404)
    db.storage.from_(BUCKET).remove([doc["file_url"]])
    db.table("project_documents").delete().eq("id", doc_id).execute()
    log_audit(
        company_id=user.company_id, actor=user,
        action="doc.delete", entity_type="project_document", entity_id=doc_id,
        metadata={"project_id": project_id, "name": doc["name"]},
    )
    return {"ok": True}
