"""
Phase 7.27: Auth module initialization
"""

from .permissions import (
    get_user_role,
    get_actor_context,
    has_permission,
    require_role,
    check_permission_or_raise,
    VALID_ROLES,
)

__all__ = [
    "get_user_role",
    "get_actor_context",
    "has_permission",
    "require_role",
    "check_permission_or_raise",
    "VALID_ROLES",
]
