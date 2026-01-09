"""
Core utilities for AutoComply AI backend.

Modules:
- authz: Authorization and role-based access control
"""

from .authz import get_role, require_admin, can_reassign_case

__all__ = [
    "get_role",
    "require_admin",
    "can_reassign_case",
]
