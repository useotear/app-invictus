"""Matriz de permissões por role.

Regra geral: todos leem tudo da sua empresa; writes são restritos pelo papel.

Ordem das fases (após reordenação 0019):
  1 Contrato | 2 Compra kit | 3 Previsão entrega | 4 Kit entregue
  5 Instalação agendada | 6 Instalação concluída
  7 Entrada Celesc | 8 Projeto em análise | 9 Projeto aprovado
  10 Troca relógio agendada | 11 Sistema ativo
  12 App de monitoramento | 13 Manutenção

- admin:        tudo
- seller:       até fase 4 (entrega do kit)
- homologation: 7, 8, 9 (Celesc) + 10, 11 (troca de relógio)
- installer:    fase 6 (marcar instalação concluída) + fotos
- scheduler:    2, 3, 4 (kit), 5 (agendar instalação), 13 (manutenção)
"""

ROLE_PHASES: dict[str, set[int]] = {
    "admin":        set(range(1, 14)),
    "seller":       {1, 2, 3, 4},
    "homologation": {7, 8, 9, 10, 11},
    "installer":    {6},
    "scheduler":    {2, 3, 4, 5, 13},
}

VALID_ROLES = set(ROLE_PHASES.keys())


def can_edit_phase(role: str, phase_number: int) -> bool:
    return phase_number in ROLE_PHASES.get(role, set())


def can_edit_project(role: str) -> bool:
    """Editar dados básicos do projeto (endereço, kWp, valores, pagamento)."""
    return role in ("admin", "seller", "scheduler")


def can_create_client(role: str) -> bool:
    return role in ("admin", "seller")


def can_manage_team(role: str) -> bool:
    return role == "admin"


def can_upload_install_photo(role: str) -> bool:
    return role in ("admin", "installer")


def can_send_reschedule_notice(role: str) -> bool:
    return role in ("admin", "scheduler", "installer")


def sees_all_clients(role: str) -> bool:
    """Se False, filtra por seller_id = próprio user."""
    return role in ("admin", "homologation", "installer", "scheduler")
