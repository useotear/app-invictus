import json
import os
import schedule
import time
import logging
import urllib.request
import urllib.error
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from config import (
    CELESC_URL_SELECAO, CELESC_URL_PROJETISTA,
    WEBHOOK_URL, ARQUIVO_HISTORICO, COOKIES_PATH,
    HORARIO_EXECUCAO, HEADLESS
)

# Configuracao de logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("celesc_monitor.log", encoding="utf-8"),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# EXTRACAO DE DADOS (JavaScript executado no navegador)
# ──────────────────────────────────────────────

JS_EXTRAIR_STATUS = """
() => {
    const raw = document.body.innerText;
    const lines = raw.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

    const pm = raw.match(/Protocolo\\s+(80\\d{8})/);
    const protocol = pm ? pm[1] : 'desconhecido';

    let address = '';
    for (let i = 0; i < lines.length; i++) {
        if (/^80\\d{8}$/.test(lines[i]) && lines[i+1] &&
            !lines[i+1].match(/^80\\d{8}$/) && (i === 0 || lines[i-1] !== 'Protocolo')) {
            address = lines[i+1];
            break;
        }
    }

    const services = [];
    let i = 0;
    while (i < lines.length) {
        if (lines[i] === 'Servico' && i + 1 < lines.length) {
            const svc = { nome: lines[i+1], etapas: [] };
            services.push(svc);
            i += 2;
            while (i < lines.length && ['remove_red_eye','delete_outline'].includes(lines[i])) i++;
            while (i < lines.length && lines[i] !== 'Servico' && lines[i] !== 'Precisa de ajuda?') {
                if (/^\\d+$/.test(lines[i]) && +lines[i] >= 1 && +lines[i] <= 20) {
                    const n = lines[i]; i++;
                    while (i < lines.length && /^(check_circle|radio_button_unchecked|circle|pending)$/.test(lines[i])) i++;
                    let en = '', ed = '', edc = '';
                    if (i < lines.length && !/^\\d+$/.test(lines[i]) && lines[i] !== 'Servico') { en = lines[i]; i++; }
                    if (i < lines.length && /^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(lines[i])) { ed = lines[i]; i++; }
                    if (i < lines.length && !/^\\d+$/.test(lines[i]) && lines[i] !== 'Servico' &&
                        lines[i] !== 'Precisa de ajuda?' && !['remove_red_eye','delete_outline'].includes(lines[i])) {
                        edc = lines[i]; i++;
                    }
                    if (en) svc.etapas.push({ num: n, etapa: en, data: ed || '-', descricao: edc || '-' });
                } else { i++; }
            }
        } else { i++; }
    }

    const aguardando = raw.includes('Servicos disponiveis para esse protocolo');

    return { protocol, address, services, aguardando };
}
"""

JS_CLICAR_PROTOCOLO = """
(idx) => {
    const pp = Array.from(document.querySelectorAll('p.md'))
        .filter(p => /^80\\d{8}$/.test(p.textContent.trim()));
    if (idx >= pp.length) return { success: false, msg: 'idx fora do range' };
    const p = pp[idx];
    let container = p, btn = null;
    for (let level = 0; level < 10; level++) {
        container = container.parentElement;
        if (!container) break;
        btn = Array.from(container.querySelectorAll('button'))
            .find(b => b.innerText && b.innerText.includes('Selecionar protocolo'));
        if (btn) break;
    }
    if (btn) { btn.click(); return { success: true, protocolo: p.textContent.trim() }; }
    return { success: false, msg: 'botao nao encontrado' };
}
"""

JS_CONTAR_PROTOCOLOS = """
() => {
    const pp = Array.from(document.querySelectorAll('p.md'))
        .filter(p => /^80\\d{8}$/.test(p.textContent.trim()));
    return pp.length;
}
"""


def verificar_sessao(page) -> bool:
    """Verifica se a sessao ainda esta valida checando se estamos na pagina correta."""
    url_atual = page.url
    if "login" in url_atual or "auth" in url_atual:
        return False
    total = page.evaluate(JS_CONTAR_PROTOCOLOS)
    return total > 0


def coletar_todos_protocolos(page) -> list[dict]:
    """Coleta o status de todos os protocolos listados na pagina de selecao."""
    log.info("Acessando pagina de selecao de protocolos...")
    page.goto(CELESC_URL_SELECAO, wait_until="networkidle")
    page.wait_for_timeout(3000)

    if not verificar_sessao(page):
        raise RuntimeError(
            "Sessao expirada! Os cookies nao sao mais validos. "
            "Execute 'python salvar_login.py' novamente para renovar a sessao."
        )

    total = page.evaluate(JS_CONTAR_PROTOCOLOS)
    log.info(f"Total de protocolos encontrados: {total}")

    resultados = []

    for idx in range(total):
        page.goto(CELESC_URL_SELECAO, wait_until="networkidle")
        page.wait_for_timeout(2000)

        resultado = page.evaluate(JS_CLICAR_PROTOCOLO, idx)
        if not resultado.get("success"):
            log.warning(f"  Nao foi possivel clicar no protocolo idx={idx}: {resultado.get('msg')}")
            continue

        protocolo_num = resultado.get("protocolo", "?")
        log.info(f"  [{idx+1}/{total}] Coletando protocolo {protocolo_num}...")

        try:
            page.wait_for_url("**/pagina-inicial/projetista**", timeout=10000)
            page.wait_for_load_state("networkidle", timeout=10000)
            page.wait_for_timeout(1500)
        except PlaywrightTimeout:
            log.warning(f"  Timeout aguardando pagina do protocolo {protocolo_num}")

        dados = page.evaluate(JS_EXTRAIR_STATUS)
        dados["coletadoEm"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        resultados.append(dados)

        log.info(f"     {dados['protocol']} - {len(dados['services'])} servico(s)")

    return resultados


# ──────────────────────────────────────────────
# COMPARACAO DE MUDANCAS
# ──────────────────────────────────────────────

def carregar_historico() -> list[dict]:
    if not os.path.exists(ARQUIVO_HISTORICO):
        return []
    with open(ARQUIVO_HISTORICO, "r", encoding="utf-8") as f:
        return json.load(f)


def salvar_historico(dados: list[dict]):
    with open(ARQUIVO_HISTORICO, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    log.info(f"Historico salvo em '{ARQUIVO_HISTORICO}'")


def detectar_mudancas(anteriores: list[dict], atuais: list[dict]) -> list[dict]:
    """Compara os dados anteriores com os atuais e retorna lista de mudancas."""
    mudancas = []

    mapa_anterior = {r["protocol"]: r for r in anteriores}
    mapa_atual = {r["protocol"]: r for r in atuais}

    for prot, dados in mapa_atual.items():
        if prot not in mapa_anterior:
            mudancas.append({
                "tipo": "NOVO_PROTOCOLO",
                "protocolo": prot,
                "endereco": dados["address"],
                "detalhe": "Protocolo apareceu pela primeira vez",
                "dados": dados
            })
            continue

        ant = mapa_anterior[prot]
        atu = mapa_atual[prot]

        mapa_svc_ant = {s["nome"]: s for s in ant.get("services", [])}
        mapa_svc_atu = {s["nome"]: s for s in atu.get("services", [])}

        for svc_nome, svc in mapa_svc_atu.items():
            if svc_nome not in mapa_svc_ant:
                mudancas.append({
                    "tipo": "NOVO_SERVICO",
                    "protocolo": prot,
                    "endereco": atu["address"],
                    "detalhe": f"Novo servico: {svc_nome}",
                    "dados": svc
                })
                continue

            etapas_ant = {e["num"]: e for e in mapa_svc_ant[svc_nome].get("etapas", [])}
            etapas_atu = {e["num"]: e for e in svc.get("etapas", [])}

            for num, etapa in etapas_atu.items():
                if num not in etapas_ant:
                    mudancas.append({
                        "tipo": "NOVA_ETAPA",
                        "protocolo": prot,
                        "endereco": atu["address"],
                        "servico": svc_nome,
                        "detalhe": f"Nova etapa {num}: {etapa['etapa']} ({etapa['data']}) - {etapa['descricao']}",
                        "dados": etapa
                    })
                elif etapa != etapas_ant[num]:
                    mudancas.append({
                        "tipo": "ETAPA_ATUALIZADA",
                        "protocolo": prot,
                        "endereco": atu["address"],
                        "servico": svc_nome,
                        "detalhe": (
                            f"Etapa {num} atualizada: {etapa['etapa']}\n"
                            f"  Antes: {etapas_ant[num]}\n"
                            f"  Agora:  {etapa}"
                        ),
                        "dados": etapa
                    })

        if ant.get("aguardando") and not atu.get("aguardando") and atu.get("services"):
            mudancas.append({
                "tipo": "INICIOU_SERVICO",
                "protocolo": prot,
                "endereco": atu["address"],
                "detalhe": "Protocolo saiu de 'aguardando' e teve servicos iniciados!",
                "dados": atu
            })

    return mudancas


# ──────────────────────────────────────────────
# NOTIFICACAO VIA WEBHOOK (n8n)
# ──────────────────────────────────────────────

def enviar_webhook(mudancas: list[dict], dados_atuais: list[dict]):
    """Envia dados para o webhook do n8n."""
    if not WEBHOOK_URL:
        log.info("Webhook nao configurado. Pulando notificacao.")
        return

    payload = {
        "evento": "mudancas_detectadas",
        "data_execucao": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "total_protocolos": len(dados_atuais),
        "total_mudancas": len(mudancas),
        "mudancas": mudancas,
        "protocolos": dados_atuais
    }

    try:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            log.info(f"Webhook enviado com sucesso - status {resp.status}")
    except urllib.error.HTTPError as e:
        log.error(f"Erro no webhook - HTTP {e.code}: {e.read().decode()}")
    except Exception as e:
        log.error(f"Erro ao enviar webhook: {e}")


def enviar_webhook_sessao_expirada():
    """Avisa via webhook que a sessao expirou."""
    if not WEBHOOK_URL:
        return

    payload = {
        "evento": "sessao_expirada",
        "data_execucao": datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "mensagem": "Sessao da Celesc expirou. Execute salvar_login.py no PC e copie os cookies para o VPS."
    }

    try:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            log.info(f"Alerta de sessao expirada enviado via webhook - status {resp.status}")
    except Exception as e:
        log.error(f"Erro ao enviar alerta de sessao expirada: {e}")


# ──────────────────────────────────────────────
# FLUXO PRINCIPAL
# ──────────────────────────────────────────────

def executar_monitoramento():
    log.info("=" * 60)
    log.info(f"Iniciando monitoramento - {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    log.info("=" * 60)

    if not os.path.exists(COOKIES_PATH):
        log.error(
            f"Arquivo '{COOKIES_PATH}' nao encontrado! "
            "Execute 'python salvar_login.py' no seu PC e copie o arquivo para o volume /app/data/"
        )
        enviar_webhook_sessao_expirada()
        return

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="pt-BR"
        )

        with open(COOKIES_PATH, "r") as f:
            cookies = json.load(f)
        context.add_cookies(cookies)
        log.info("Cookies carregados com sucesso.")

        page = context.new_page()

        try:
            dados_atuais = coletar_todos_protocolos(page)
        except RuntimeError as e:
            log.error(str(e))
            enviar_webhook_sessao_expirada()
            browser.close()
            return
        except Exception as e:
            log.error(f"Erro durante coleta: {e}")
            browser.close()
            return

        # Renovar cookies ANTES de fechar o browser
        try:
            cookies_atualizados = context.cookies()
            with open(COOKIES_PATH, "w") as f:
                json.dump(cookies_atualizados, f, indent=2)
            log.info("Cookies renovados e salvos.")
        except Exception as e:
            log.warning(f"Nao foi possivel renovar cookies: {e}")

        browser.close()

    # Comparar com historico
    dados_anteriores = carregar_historico()

    if not dados_anteriores:
        log.info("Primeiro registro - salvando como historico base.")
        salvar_historico(dados_atuais)
        # Enviar snapshot inicial pro webhook
        enviar_webhook([], dados_atuais)
        log.info(f"{len(dados_atuais)} protocolos salvos como base.")
        return

    mudancas = detectar_mudancas(dados_anteriores, dados_atuais)

    if mudancas:
        log.info(f"\n{len(mudancas)} MUDANCA(S) DETECTADA(S):")
        for m in mudancas:
            log.info(f"  [{m['tipo']}] Protocolo {m['protocolo']}: {m['detalhe']}")
        enviar_webhook(mudancas, dados_atuais)
    else:
        log.info("Nenhuma mudanca detectada.")

    salvar_historico(dados_atuais)

    log.info(f"Monitoramento concluido. Proxima execucao: {HORARIO_EXECUCAO}")


# ──────────────────────────────────────────────
# AGENDAMENTO DIARIO
# ──────────────────────────────────────────────

if __name__ == "__main__":
    log.info(f"Celesc Monitor iniciado. Execucao agendada para {HORARIO_EXECUCAO} diariamente.")

    executar_monitoramento()

    schedule.every().day.at(HORARIO_EXECUCAO).do(executar_monitoramento)

    while True:
        schedule.run_pending()
        time.sleep(60)
