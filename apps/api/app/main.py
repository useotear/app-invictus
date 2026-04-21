from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import clients, projects, phases, push, maintenance

app = FastAPI(title="Invictus Solar API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restringir em produção ao domínio do PWA
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router)
app.include_router(projects.router)
app.include_router(phases.router)
app.include_router(push.router)
app.include_router(maintenance.router)


@app.get("/health")
def health():
    return {"ok": True}
