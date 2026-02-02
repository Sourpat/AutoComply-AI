# backend/src/api/dependencies/auth.py
"""
Authentication dependencies for admin endpoints.

Provides FastAPI dependencies to verify admin access based on X-User-Role header.
Frontend sets this header based on localStorage 'admin_unlocked' state.
"""

from fastapi import Header, HTTPException, status
from typing import Annotated, Iterable


def require_admin_role(
    x_user_role: Annotated[str | None, Header()] = None
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
    if not x_user_role or x_user_role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "admin_access_required",
                "message": "This endpoint requires admin privileges. Admin mode must be unlocked in the UI.",
            }
        )
    
    return x_user_role


def _normalize_role(*values: str | None) -> str | None:
    for value in values:
        if value and str(value).strip():
            return str(value).strip().lower()
    return None


def require_roles(
    allowed_roles: Iterable[str],
    x_user_role: Annotated[str | None, Header()] = None,
    x_autocomply_role: Annotated[str | None, Header(alias="X-AutoComply-Role")] = None,
) -> str:
    role = _normalize_role(x_autocomply_role, x_user_role)
    allowed = {r.lower() for r in allowed_roles}
    if not role or role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "role_not_allowed",
                "message": "This endpoint requires an authorized role.",
            },
        )
    return role


def require_override_role(
    x_user_role: Annotated[str | None, Header()] = None,
    x_autocomply_role: Annotated[str | None, Header(alias="X-AutoComply-Role")] = None,
) -> str:
    return require_roles(
        {"verifier", "devsupport", "admin"},
        x_user_role=x_user_role,
        x_autocomply_role=x_autocomply_role,
    )
