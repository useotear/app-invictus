"""Importa protocolos do snapshot Celesc para o Invictus via API.

Uso:
  python importar_snapshot.py snapshot_celesc_2026-04-22_em_andamento.json

Requer no .env:
  INVICTUS_API_URL=http://localhost:8000  (ou URL pública)
  INVICTUS_COMPANY_ID=uuid-da-empresa
  INVICTUS_CELESC_SECRET=mesmo secret do backend
"""
import json
import os
import sys
import urllib.request
import urllib.error
from dotenv import load_dotenv

from listar_protocolos import derivar_fase_invictus

load_dotenv()

API_URL = os.getenv("INVICTUS_API_URL", "http://localhost:8000").rstrip("/")
COMPANY_ID = os.getenv("INVICTUS_COMPANY_ID", "00000000-0000-0000-0000-000000000001")
SECRET = os.getenv("INVICTUS_CELESC_SECRET", "")


def main():
    if len(sys.argv) < 2:
        print("Uso: python importar_snapshot.py <arquivo.json>")
        sys.exit(1)
    if not SECRET:
        print("INVICTUS_CELESC_SECRET não configurado no .env")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        raw = json.load(f)

    items = []
    for r in raw:
        fase, _ = derivar_fase_invictus(r)
        client = r.get("client") or {}
        items.append({
            "protocol": r.get("protocol"),
            "address": r.get("address"),
            "invictus_phase": fase,
            "client": {
                "name": client.get("name"),
                "cpf_cnpj": client.get("cpf_cnpj"),
                "phone_mobile": client.get("phone_mobile"),
                "phone_fixed": client.get("phone_fixed"),
                "email": client.get("email"),
            },
        })

    payload = {"company_id": COMPANY_ID, "items": items}
    req = urllib.request.Request(
        f"{API_URL}/celesc/import",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Celesc-Secret": SECRET},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8")
            print(f"[{resp.status}] {body}")
    except urllib.error.HTTPError as e:
        print(f"Erro HTTP {e.code}: {e.read().decode()}")
        sys.exit(1)
    except Exception as e:
        print(f"Erro: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
