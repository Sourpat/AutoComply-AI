# backend/src/api/dependencies/auth.py
"""
Authentication dependencies for admin endpoints.

Provides FastAPI dependencies to verify admin access based on X-User-Role header.
Frontend sets this header based on localStorage 'admin_unlocked' state.
"""

from fastapi import Header, HTTPException, status
from typing import Annotated, Iterable

from src.config import get_settings

ROLE_HEADER = "x-user-role"
AUTO_ROLE_HEADER = "x-autocomply-role"
DEV_SEED_HEADER = "x-dev-seed-token"


def require_admin_role(
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> str:
    """
    Dependency that requires admin role.
    
    Frontend sends X-User-Role: admin when localStorage.getItem('admin_unlocked') === 'true'.
    This dependency verifies that header is present and set to 'admin'.
    
    Args:
        x_user_role: X-User-Role header from request
        
    Returns:
        The role ('admin')
        
    Raises:
        HTTPException: 403 if role is not 'admin' or header is missing
        
    Usage:
        @router.get("/admin/endpoint")
        async def admin_endpoint(role: str = Depends(require_admin_role)):
            # Only accessible if X-User-Role: admin header is present
            ...
    """
    role = _normalize_role(x_autocomply_role, x_user_role)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden: missing role header",
        )
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden: admin role required",
        )

    return role


def _normalize_role(*values: str | None) -> str | None:
    for value in values:
        if value and str(value).strip():
            return str(value).strip().lower()
    return None


def require_roles(
    allowed_roles: Iterable[str],
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> str:
    role = _normalize_role(x_autocomply_role, x_user_role)
    allowed = {r.lower() for r in allowed_roles}
    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden: missing role header",
        )
    if role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden: role not allowed",
        )
    return role


def require_override_role(
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
) -> str:
    return require_roles(
        {"verifier", "devsupport", "admin"},
        x_user_role=x_user_role,
        x_autocomply_role=x_autocomply_role,
    )


def require_review_queue_role(
    x_user_role: Annotated[str | None, Header(alias=ROLE_HEADER)] = None,
    x_autocomply_role: Annotated[str | None, Header(alias=AUTO_ROLE_HEADER)] = None,
    x_dev_seed_token: Annotated[str | None, Header(alias=DEV_SEED_HEADER)] = None,
) -> str:
    settings = get_settings()
    role = require_roles(
        {"admin", "verifier", "devsupport"},
        x_user_role=x_user_role,
        x_autocomply_role=x_autocomply_role,
    )

    if settings.DEV_SEED_TOKEN:
        if not x_dev_seed_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="forbidden: missing dev seed token",
            )
        if x_dev_seed_token != settings.DEV_SEED_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="forbidden: dev seed token invalid",
            )

    if settings.is_production and role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden: admin role required in production",
        )

    return role
