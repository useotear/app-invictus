"""Matriz de permissões por role.

Regra geral: todos leem tudo da sua empresa; writes são restritos pelo papel.

Ordem das fases (após reordenação 0020):
  1 Contrato | 2 Compra kit | 3 Previsão entrega | 4 Kit entregue
  5 Instalação agendada
  6 Entrada Celesc | 7 Projeto em análise | 8 Projeto aprovado
  9 Instalação concluída
  10 Troca relógio agendada | 11 Sistema ativo
  12 App de monitoramento | 13 Manutenção

- admin:        tudo
- seller:       até fase 4 (entrega do kit)
- homologation: 6, 7, 8 (Celesc) + 10, 11 (troca de relógio)
- installer:    fase 9 (marcar instalação concluída) + fotos
- scheduler:    2, 3, 4 (kit), 5 (agendar instalação), 13 (manutenção)
"""

ROLE_PHASES: dict[str, set[int]] = {
    "admin":        set(range(1, 14)),
    "seller":       {1, 2, 3, 4},
    "homologation": {6, 7, 8, 10, 11},
    "installer":    {9},
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
