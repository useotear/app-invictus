import os
from dotenv import load_dotenv

load_dotenv()

# Credenciais Celesc
CELESC_URL_SELECAO = "https://conecte.celesc.com.br/contrato/selecao"
CELESC_URL_PROJETISTA = "https://conecte.celesc.com.br/pagina-inicial/projetista"

# Notificacao por e-mail (opcional)
EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "")
EMAIL_SENHA = os.getenv("EMAIL_SENHA", "")
EMAIL_DESTINATARIO = os.getenv("EMAIL_DESTINATARIO", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

# Arquivo de historico
ARQUIVO_HISTORICO = "dados_anteriores.json"

# Horario de execucao diaria (formato "HH:MM")
HORARIO_EXECUCAO = "08:00"

# Mostrar navegador (False = modo headless/invisivel)
HEADLESS = True
