#!/bin/bash
# Setup do Celesc Monitor no VPS Ubuntu
# Uso: bash setup_vps.sh

set -e

echo "========================================="
echo " Celesc Monitor - Setup VPS Ubuntu"
echo "========================================="

# Atualizar sistema
echo "[1/5] Atualizando sistema..."
sudo apt update && sudo apt upgrade -y

# Instalar Python e dependencias do sistema
echo "[2/5] Instalando Python e dependencias..."
sudo apt install -y python3 python3-pip python3-venv

# Criar diretorio do projeto
echo "[3/5] Configurando projeto..."
mkdir -p ~/celesc_monitor
cd ~/celesc_monitor

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias Python
pip install playwright python-dotenv schedule
playwright install chromium
playwright install-deps

echo "[4/5] Criando servico systemd..."
sudo tee /etc/systemd/system/celesc-monitor.service > /dev/null <<EOF
[Unit]
Description=Celesc Monitor - Monitoramento de protocolos
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/celesc_monitor
ExecStart=$HOME/celesc_monitor/venv/bin/python celesc_monitor.py
Restart=always
RestartSec=60
StandardOutput=append:$HOME/celesc_monitor/celesc_monitor.log
StandardError=append:$HOME/celesc_monitor/celesc_monitor.log

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable celesc-monitor

echo "[5/5] Setup concluido!"
echo ""
echo "========================================="
echo " Proximos passos:"
echo "========================================="
echo ""
echo " 1. Copie os arquivos do projeto para ~/celesc_monitor/"
echo "    (celesc_monitor.py, config.py, .env, celesc_cookies.json)"
echo ""
echo " 2. Inicie o servico:"
echo "    sudo systemctl start celesc-monitor"
echo ""
echo " 3. Verifique o status:"
echo "    sudo systemctl status celesc-monitor"
echo ""
echo " 4. Ver logs:"
echo "    tail -f ~/celesc_monitor/celesc_monitor.log"
echo ""
echo " 5. Se a sessao expirar, gere novos cookies no seu PC"
echo "    e copie para o VPS com:"
echo "    scp celesc_cookies.json usuario@seu-vps:~/celesc_monitor/"
echo "========================================="
