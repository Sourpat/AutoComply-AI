# backend/src/api/dependencies/auth.py
"""
Authentication dependencies for admin endpoints.

Provides FastAPI dependencies to verify admin access based on X-User-Role header.
Frontend sets this header based on localStorage 'admin_unlocked' state.
"""

from fastapi import Header, HTTPException, status
from typing import Annotated


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
