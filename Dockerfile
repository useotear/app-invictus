FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias do sistema para Playwright
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 libx11-xcb1 \
    libxfixes3 fonts-liberation libgl1-mesa-dri && \
    rm -rf /var/lib/apt/lists/*

COPY celesc_monitor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium

COPY celesc_monitor/config.py celesc_monitor/celesc_monitor.py ./

VOLUME ["/app/data"]

ENV ARQUIVO_HISTORICO=/app/data/dados_anteriores.json
ENV COOKIES_PATH=/app/data/celesc_cookies.json

CMD ["python", "-u", "celesc_monitor.py"]
