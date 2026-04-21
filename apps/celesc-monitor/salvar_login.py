"""
Execute este script UMA VEZ para fazer login manualmente
e salvar os cookies da sessao.

Uso: python salvar_login.py
"""
import json
import time
from playwright.sync_api import sync_playwright


URL_CELESC = "https://conecte.celesc.com.br/contrato/selecao"
MAX_TENTATIVAS = 5


def salvar_sessao():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=1000)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        )
        page = context.new_page()

        print("=" * 50)
        print("Abrindo o site da Celesc...")
        print("Faca seu LOGIN normalmente no navegador.")
        print("Quando estiver na tela de selecao de protocolos,")
        print("volte aqui e pressione ENTER.")
        print("=" * 50)

        # Tentar navegar com retries - site pode resetar conexao
        navegou = False
        for tentativa in range(1, MAX_TENTATIVAS + 1):
            try:
                print(f"\nTentativa {tentativa}/{MAX_TENTATIVAS} de acessar o site...")
                page.goto(URL_CELESC, timeout=60000, wait_until="commit")
                navegou = True
                print("Site carregado com sucesso!")
                break
            except Exception as e:
                print(f"Erro na tentativa {tentativa}: {e}")
                if tentativa < MAX_TENTATIVAS:
                    espera = tentativa * 10
                    print(f"Aguardando {espera} segundos antes de tentar novamente...")
                    time.sleep(espera)

        if not navegou:
            print(
                "\n--------------------------------------------"
                "\nNao foi possivel acessar o site automaticamente."
                "\nO navegador continua aberto!"
                "\nDigite a URL manualmente na barra de endereco:"
                f"\n  {URL_CELESC}"
                "\nFaca login e depois pressione ENTER aqui."
                "\n--------------------------------------------"
            )

        input("\nPressione ENTER apos fazer login e chegar na tela de protocolos...")

        cookies = context.cookies()
        with open("celesc_cookies.json", "w") as f:
            json.dump(cookies, f, indent=2)

        print(f"\n{len(cookies)} cookies salvos em 'celesc_cookies.json'")
        print("Agora voce pode rodar 'python celesc_monitor.py'")

        browser.close()


if __name__ == "__main__":
    salvar_sessao()
