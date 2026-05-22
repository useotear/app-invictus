from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings
from .routers import auth, celesc, clients, documents, maintenance, me, phases, photos, projects, push, schedule

if settings.sentry_dsn:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        send_default_pii=False,
    )

limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

api = FastAPI(title="Invictus Solar API", version="1.0.0")
api.state.limiter = limiter


@api.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit excedido"})


@api.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import logging
    logging.getLogger("api").exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor"})


@api.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


api.include_router(auth.router)
api.include_router(clients.router)
api.include_router(projects.router)
api.include_router(documents.router)
api.include_router(phases.router)
api.include_router(push.router)
api.include_router(maintenance.router)
api.include_router(celesc.router)
api.include_router(me.router)
api.include_router(schedule.router)
api.include_router(photos.router)


@api.get("/health")
def health():
    return {"ok": True}


@api.get("/health/ready")
def health_ready():
    from .db import db

    try:
        db.table("companies").select("id").limit(1).execute()
        return {"ok": True, "db": "up"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"ok": False, "db": "down", "error": type(e).__name__})


allowed = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app = CORSMiddleware(
    api,
    allow_origins=allowed or [settings.portal_base_url],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Cron-Secret"],
)
