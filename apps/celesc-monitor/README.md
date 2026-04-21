# Celesc Monitor

Scraper que monitora o portal da Celesc (Playwright) e notifica mudanças de status de projetos fotovoltaicos via webhook n8n.

## Build & run (Docker)

Contexto do build é **este diretório** (não a raiz do repo):

```bash
docker build -t celesc-monitor apps/celesc-monitor
docker run -d --name celesc-monitor \
  --env-file apps/celesc-monitor/.env \
  -v celesc_data:/app/data \
  celesc-monitor
```

### EasyPanel / outros deploys
Configurar o **build context** = `apps/celesc-monitor/` e o **Dockerfile path** = `Dockerfile` (relativo ao contexto).

## Setup inicial (cookies)

O scraper depende de cookies válidos da Celesc em `/app/data/celesc_cookies.json`. Pra gerar:

```bash
python salvar_login.py   # login manual, grava cookies
```

Copiar o arquivo gerado pro volume `celesc_data`.

## Configuração

Ver [.env.example](.env.example).
