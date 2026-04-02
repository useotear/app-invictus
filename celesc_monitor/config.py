import os
from dotenv import load_dotenv

load_dotenv()

# Credenciais Celesc
CELESC_URL_SELECAO = "https://conecte.celesc.com.br/contrato/selecao"
CELESC_URL_PROJETISTA = "https://conecte.celesc.com.br/pagina-inicial/projetista"

# Webhook para notificacoes (n8n)
WEBHOOK_URL = os.getenv(
    "WEBHOOK_URL",
    "https://n8nwebh.otear.com.br/webhook/status-celesc"
)

# Arquivo de historico e cookies (via env para Docker)
ARQUIVO_HISTORICO = os.getenv("ARQUIVO_HISTORICO", "dados_anteriores.json")
COOKIES_PATH = os.getenv("COOKIES_PATH", "celesc_cookies.json")

# Horario de execucao diaria (formato "HH:MM")
HORARIO_EXECUCAO = "08:00"

# Mostrar navegador (False = modo headless/invisivel)
HEADLESS = True
