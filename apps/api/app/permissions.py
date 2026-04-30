"""Matriz de permissões por role.

Regra geral: todos leem tudo da sua empresa; writes são restritos pelo papel.

Ordem das fases (após 0022):
  1 Contrato | 2 Compra kit | 3 lança venda RP (admin only)
  4 Previsão entrega | 5 Kit entregue | 6 Instalação agendada
  7 Entrada Celesc | 8 Projeto em análise | 9 Projeto aprovado
  10 Instalação concluída
  11 Troca relógio agendada | 12 Sistema ativo
  13 App de monitoramento | 14 Manutenção

- admin:        tudo (única role que vê fase 3)
- seller:       1, 2, 4, 5 (até entrega do kit, pula fase 3)
- homologation: 7, 8, 9 (Celesc) + 11, 12 (troca de relógio)
- installer:    fase 10 (marcar instalação concluída) + fotos
- scheduler:    2, 4, 5 (kit), 6 (agendar instalação), 14 (manutenção)
"""

# Fases que só admin enxerga e edita
ADMIN_ONLY_PHASES: set[int] = {3}

ROLE_PHASES: dict[str, set[int]] = {
    "admin":        set(range(1, 15)),
    "seller":       {1, 2, 4, 5},
    "homologation": {7, 8, 9, 11, 12},
    "installer":    {10},
    "scheduler":    {2, 4, 5, 6, 14},
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
