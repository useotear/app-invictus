# Invictus Solar — monorepo

Três aplicações independentes, cada uma com seu próprio Dockerfile e deploy:

| App | Path | O que faz |
|---|---|---|
| **web** | [apps/web/](apps/web/) | PWA Next.js — painel admin + portal do cliente |
| **api** | [apps/api/](apps/api/) | Backend FastAPI — projetos, fases, notificações |
| **celesc-monitor** | [apps/celesc-monitor/](apps/celesc-monitor/) | Scraper do portal Celesc (existente, mantido separado) |

Ver [`PRD_Invictus_App.docx`](PRD_Invictus_App.docx) para o escopo do MVP.

## Stack

- **Frontend/PWA:** Next.js 14 (App Router) + Tailwind — [`apps/web`](apps/web)
- **Backend:** FastAPI (Python 3.12) — [`apps/api`](apps/api)
- **Banco/Auth/Realtime/Storage:** Supabase (PostgreSQL) — [`supabase/`](supabase)
- **WhatsApp:** Evolution API via webhook (trocar em [`apps/api/app/services/whatsapp.py`](apps/api/app/services/whatsapp.py) se Z-API)
- **Push:** Web Push API + VAPID ([`pywebpush`](https://github.com/web-push-libs/pywebpush))

## Setup local

### 1. Supabase
1. Criar projeto em https://supabase.com
2. Rodar as migrations na ordem:
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   - [`supabase/migrations/0002_rls.sql`](supabase/migrations/0002_rls.sql)
   - [`supabase/seed.sql`](supabase/seed.sql)
3. Copiar `SUPABASE_URL`, `anon key` e `service_role key` do dashboard.

### 2. VAPID keys (push)
```bash
npx web-push generate-vapid-keys
```
Colar em `apps/api/.env`.

### 3. Backend
```bash
cd apps/api
cp .env.example .env   # preencher
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 4. Frontend
```bash
cd apps/web
cp .env.example .env   # preencher
npm install
npm run dev
```

Acessar:
- Painel admin: http://localhost:3000/admin
- Portal cliente: http://localhost:3000/portal/{access_token}

### Docker (tudo junto)
```bash
docker compose up --build
```

## Fluxo

1. Admin cadastra cliente em [/admin/clients](http://localhost:3000/admin/clients) → API cria `access_token` e envia link via WhatsApp.
2. Admin cria projeto → trigger `seed_project_phases` instancia as 12 fases automaticamente.
3. Admin abre projeto e clica **Concluir** em uma fase → FastAPI:
   - atualiza `project_phases` e avança `current_phase` do projeto
   - em background, envia WhatsApp + Web Push usando templates de [`supabase/seed.sql`](supabase/seed.sql)
   - registra em `notifications_log`
4. Portal do cliente recebe o update via Supabase Realtime (timeline atualiza sozinha).

## Cron de manutenção

Agendar POST diário em `/cron/maintenance-check` (Railway cron, GitHub Actions, etc.) para disparar lembrete 1 ano após instalação.

## Deploy

- **Frontend** → Vercel (importar `apps/web`)
- **Backend** → Railway/EasyPanel com o Dockerfile de `apps/api`
- **DB** → Supabase hosted

## Próximos passos (fora do MVP)

- Auth real da equipe (magic link via Supabase Auth) — hoje o painel admin assume `COMPANY_ID` fixo
- Upload de fotos/documentos (rota e UI)
- Edição de templates de notificação via painel
- Monitoramento de geração (pós-instalação)
