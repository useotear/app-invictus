"""Matriz de permissões por role.

Regra geral: todos leem tudo da sua empresa; writes são restritos pelo papel.

- admin:        tudo
- seller:       até fase 4 (entrega do kit) + criar/editar cliente e projeto
- homologation: fases 5, 6, 7, 10, 11 (Celesc + troca de relógio)
- installer:    fase 9 (marcar instalação concluída) + fotos
- scheduler:    fases 2, 3, 4 (controle de kit), 8 (agendar instalação), 12 (manutenção)
"""

ROLE_PHASES: dict[str, set[int]] = {
    "admin":        set(range(1, 14)),
    "seller":       {1, 2, 3, 4},
    "homologation": {5, 6, 7, 10, 11},
    "installer":    {9},
    "scheduler":    {2, 3, 4, 8, 12},
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
