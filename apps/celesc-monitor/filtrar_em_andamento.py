"""Filtra um snapshot já salvo e mostra só protocolos com processo em andamento
(fases Invictus 5, 6 ou 7).

Uso:
  python filtrar_em_andamento.py                             # usa snapshot de hoje
  python filtrar_em_andamento.py snapshot_celesc_2026-04-22.json
"""
import json
import sys
from datetime import datetime
from listar_protocolos import derivar_fase_invictus


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else f"snapshot_celesc_{datetime.now().strftime('%Y-%m-%d')}.json"
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)

    em_andamento = [r for r in rows if derivar_fase_invictus(r)[0] < 11]

    print(f"\nProtocolos EM ANDAMENTO ({len(em_andamento)}/{len(rows)}):\n")
    print(f"{'Protocolo':<12} {'Cliente':<32} {'CPF/CNPJ':<18} {'Fase'}")
    print("-" * 100)
    for r in em_andamento:
        proto = r.get("protocol", "?")
        client = (r.get("client") or {}).get("name") or "—"
        cpf = (r.get("client") or {}).get("cpf_cnpj") or "—"
        fase, label = derivar_fase_invictus(r)
        phone = (r.get("client") or {}).get("phone_mobile") or "—"
        print(f"{proto:<12} {client[:30]:<32} {cpf:<18} {fase}/12 — {label}")
        print(f"{'':<12} {'tel: '+phone:<32}")

    out = path.replace(".json", "_em_andamento.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(em_andamento, f, ensure_ascii=False, indent=2)
    print(f"\nJSON filtrado salvo em {out}")


if __name__ == "__main__":
    main()
