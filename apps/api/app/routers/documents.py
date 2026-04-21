"""Upload/list/delete de documentos de projeto via Supabase Storage."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from ..db import db
from ..deps import AdminUser, require_admin

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])

BUCKET = "project-documents"
ALLOWED_MIME = {
    "application/pdf",
    "image/png", "image/jpeg", "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
MAX_BYTES = 15 * 1024 * 1024  # 15 MB


def _assert_project_in_company(project_id: str, company_id: str) -> None:
    row = db.table("projects").select("company_id").eq("id", project_id).single().execute().data
    if not row or row["company_id"] != company_id:
        raise HTTPException(404, "Projeto não encontrado")


@router.post("")
async def upload_document(
    project_id: str,
    file: UploadFile = File(...),
    label: str | None = Form(None),
    user: AdminUser = Depends(require_admin),
):
    _assert_project_in_company(project_id, user.company_id)

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Tipo não permitido: {file.content_type}")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, f"Arquivo maior que {MAX_BYTES // (1024*1024)}MB")

    safe_name = (file.filename or "arquivo").replace("/", "_").replace("\\", "_")
    path = f"{project_id}/{safe_name}"

    storage = db.storage.from_(BUCKET)
    storage.upload(
        path=path,
        file=content,
        file_options={"content-type": file.content_type, "upsert": "true"},
    )

    row = db.table("project_documents").insert({
        "project_id": project_id,
        "name": label or safe_name,
        "file_url": path,
        "uploaded_by": user.user_id,
    }).execute().data[0]

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
    return {"ok": True}
