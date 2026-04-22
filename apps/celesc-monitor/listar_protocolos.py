"""Lista os protocolos ativos na Celesc hoje — snapshot único para mapeamento manual.

Uso:
  1. Rode salvar_login.py uma vez (abre browser, você loga, salva cookies)
  2. python listar_protocolos.py
  Saída:
    - Tabela impressa no terminal
    - JSON em snapshot_celesc_YYYY-MM-DD.json
"""
import json
import os
import sys
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from config import (
    CELESC_URL_SELECAO,
    COOKIES_PATH,
    HEADLESS,
)
from celesc_monitor import (
    JS_EXTRAIR_STATUS,
    JS_CLICAR_PROTOCOLO,
    JS_CONTAR_PROTOCOLOS,
    fazer_login,
    salvar_cookies,
    verificar_sessao,
)


def coletar():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        context = browser.new_context(viewport={"width": 1280, "height": 800}, locale="pt-BR")

        if os.path.exists(COOKIES_PATH):
            with open(COOKIES_PATH, "r") as f:
                context.add_cookies(json.load(f))

        page = context.new_page()

        try:
            page.goto(CELESC_URL_SELECAO, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)
            if not verificar_sessao(page):
                raise RuntimeError("Sessão expirada")
        except Exception:
            print(">> Sessão expirada, tentando login automático...")
            if not fazer_login(page):
                print(">> Login falhou. Rode salvar_login.py manualmente.")
                browser.close()
                sys.exit(1)
            salvar_cookies(context)
            page.goto(CELESC_URL_SELECAO, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(3000)

        total = page.evaluate(JS_CONTAR_PROTOCOLOS)
        print(f"Total de protocolos encontrados: {total}\n")

        resultados = []
        for idx in range(total):
            page.goto(CELESC_URL_SELECAO, wait_until="networkidle")
            page.wait_for_timeout(2000)
            r = page.evaluate(JS_CLICAR_PROTOCOLO, idx)
            if not r.get("success"):
                continue
            try:
                page.wait_for_url("**/pagina-inicial/projetista**", timeout=10000)
                page.wait_for_load_state("networkidle", timeout=10000)
                # Espera Angular renderizar (o texto "Dados do cliente" só aparece após API)
                page.wait_for_timeout(6000)
                try:
                    page.locator("text=/Dados do cliente|Serviços disponíveis|Serviços concluídos/").first.wait_for(
                        state="visible", timeout=10000
                    )
                except PlaywrightTimeout:
                    pass
            except PlaywrightTimeout:
                pass

            dados = page.evaluate(JS_EXTRAIR_STATUS)
            dados["coletadoEm"] = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
            resultados.append(dados)
            print(f"  [{idx+1}/{total}] {dados.get('protocol')} — {(dados.get('client') or {}).get('name') or '?'}")

        browser.close()
    return resultados


INVICTUS_PHASE_MAP = [
    # (palavras-chave na etapa Celesc, fase Invictus, label)
    (("execução",), 11, "Sistema ativo (Celesc aprovou execução)"),
    (("análise do projeto", "projeto liberado", "projeto aprovado", "parecer"), 7, "Projeto aprovado"),
    (("análise de solicitação", "consulta prévia"), 6, "Projeto em análise"),
    (("aguardando",), 5, "Entrada do projeto na Celesc"),
]


def derivar_fase_invictus(row: dict) -> tuple[int, str]:
    """Dado um protocolo, deriva a fase Invictus (5, 6, 7 ou 11) e um label."""
    services = row.get("services") or []
    # Se tem serviço "Execução de geração" com etapa concluída → fase 11
    for svc in services:
        if "execução" in (svc.get("nome") or "").lower():
            etapas = svc.get("etapas") or []
            if any(e.get("data") and e["data"] != "-" for e in etapas):
                return 11, "Sistema ativo (execução aprovada)"
    # Se tem serviço "Projeto de geração" com "Análise do projeto" concluída → fase 7
    for svc in services:
        if "projeto" in (svc.get("nome") or "").lower():
            for et in svc.get("etapas") or []:
                titulo = (et.get("titulo") or "").lower()
                if "análise do projeto" in titulo or "projeto liberado" in titulo:
                    return 7, "Projeto aprovado pela Celesc"
    # Se tem qualquer etapa de "análise de solicitação" → fase 6
    for svc in services:
        for et in svc.get("etapas") or []:
            titulo = (et.get("titulo") or "").lower()
            if "análise" in titulo or "solicitação" in titulo or "consulta prévia" in titulo:
                return 6, "Projeto em análise"
    if row.get("aguardando"):
        return 5, "Entrada do projeto na Celesc (aguardando)"
    return 5, "Protocolo existe na Celesc"


def imprimir_tabela(rows: list[dict]):
    cols = ("Protocolo", "Cliente", "CPF/CNPJ", "Fase sugerida")
    print(f"\n{cols[0]:<12} {cols[1]:<32} {cols[2]:<18} {cols[3]}")
    print("-" * 100)
    for r in rows:
        proto = r.get("protocol", "?")
        client = (r.get("client") or {}).get("name") or "—"
        cpf = (r.get("client") or {}).get("cpf_cnpj") or "—"
        fase, label = derivar_fase_invictus(r)
        print(f"{proto:<12} {client[:30]:<32} {cpf:<18} {fase}/12 — {label}")


def main():
    em_andamento_only = "--em-andamento" in sys.argv
    rows = coletar()

    if em_andamento_only:
        rows = [r for r in rows if derivar_fase_invictus(r)[0] < 11]

    print()
    imprimir_tabela(rows)
    print(f"\nTotal: {len(rows)} protocolo(s)"
          f"{' em andamento' if em_andamento_only else ''}.")

    suffix = "_em_andamento" if em_andamento_only else ""
    out = f"snapshot_celesc_{datetime.now().strftime('%Y-%m-%d')}{suffix}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    print(f"JSON salvo em {out}")


if __name__ == "__main__":
    main()
