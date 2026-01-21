"""
Phase 7.27: RBAC + Permissions Hardening
Centralized role-based access control for intelligence endpoints.

Provides:
- Role extraction from headers (x-user-role, x-role, X-AutoComply-Role)
- Permission decorators (@require_role)
- Consistent 403 error handling

Author: AutoComply AI
Date: 2026-01-20
"""

from functools import wraps
from typing import List, Optional
from fastapi import Request, HTTPException
from starlette.requests import Request as StarletteRequest


# Valid roles in AutoComply
VALID_ROLES = ["admin", "verifier", "devsupport"]


def get_user_role(request: Request = None) -> str:
    """
    Extract user role from request headers or state.
    
    Priority order:
    1. x-user-role header
    2. x-role header
    3. X-AutoComply-Role header
    4. request.state.user_role (if set by middleware)
    5. Default: "admin" if no request (testing), else "verifier"
    
    Args:
        request: FastAPI Request object (None for direct testing)
        
    Returns:
        Role string (admin, verifier, or devsupport), lowercased
        
    Example:
        >>> role = get_user_role(request)
        >>> if role == 'admin':
        ...     # Allow admin action
    """
    if not request:
        return "admin"  # Default for direct testing without request
    
    role = (
        request.headers.get("x-user-role") or
        request.headers.get("x-role") or
        request.headers.get("X-AutoComply-Role") or
        getattr(request.state, "user_role", None) or
        "verifier"
    ).lower()
    
    # Validate role
    if role not in VALID_ROLES:
        role = "verifier"
    
    return role


def check_admin_unlocked(request: Request = None) -> bool:
    """
    Check if admin unlock is active (for dev/testing).
    
    Checks:
    - Query param: admin_unlocked=1 or admin_unlocked=true
    - Header: x-admin-unlocked=1
    
    Args:
        request: FastAPI Request object (None for direct testing)
        
    Returns:
        True if admin unlock is active or no request (testing), False otherwise
        
    Note:
        This is for development/testing only. Production should use proper auth.
    """
    if not request:
        return True  # Default for direct testing
    
    # Check query param
    admin_param = request.query_params.get("admin_unlocked", "").lower()
    if admin_param in ["1", "true"]:
        return True
    
    # Check header
    admin_header = request.headers.get("x-admin-unlocked", "").lower()
    if admin_header == "1":
        return True
    
    return False


def get_actor_context(request: Request = None) -> dict:
    """
    Extract full actor context from request.
    
    Args:
        request: FastAPI Request object (None for direct testing)
    
    Returns:
        Dict with keys:
        - user: str (actor identifier)
        - role: str (admin, verifier, devsupport)
        - admin_unlocked: bool (dev bypass flag)
        
    Example:
        >>> ctx = get_actor_context(request)
        >>> if ctx['admin_unlocked'] or ctx['role'] == 'admin':
        ...     # Allow action
    """
    role = get_user_role(request)
    admin_unlocked = check_admin_unlocked(request)
    
    # Extract user/actor identifier
    if not request:
        user = "test-admin"  # Default for testing
    else:
        user = (
            request.headers.get("X-AutoComply-Actor") or
            request.headers.get("x-user") or
            role
        )
    
    return {
        "user": user,
        "role": role,
        "admin_unlocked": admin_unlocked,
    }


def has_permission(request: Request, required_roles: List[str]) -> bool:
    """
    Check if request has permission based on role or admin unlock.
    
    Args:
        request: FastAPI Request object
        required_roles: List of roles that have permission (e.g., ['admin', 'verifier'])
        
    Returns:
        True if permission granted, False otherwise
        
    Example:
        >>> if has_permission(request, ['admin', 'devsupport']):
        ...     # Allow privileged action
    """
    ctx = get_actor_context(request)
    
    # Admin unlock bypasses role check (dev/testing)
    if ctx["admin_unlocked"]:
        return True
    
    # Check if role is in required roles
    return ctx["role"] in required_roles


def require_role(*allowed_roles: str):
    """
    Decorator to enforce role-based access control on endpoints.
    
    Raises HTTPException(403) if request role is not in allowed_roles
    and admin_unlocked is not set.
    
    Args:
        *allowed_roles: Variable number of role strings (e.g., 'admin', 'verifier')
        
    Returns:
        Decorator function
        
    Example:
        @router.post("/admin/action")
        @require_role("admin", "devsupport")
        async def admin_action(request: Request):
            # Only admin or devsupport can access
            ...
            
    Raises:
        HTTPException(403): If role not permitted and admin_unlocked not set
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, request: Request = None, **kwargs):
            # Resolve request object
            req = request
            if not req:
                req = kwargs.pop("request", None)
            if not req:
                # Fallback: scan args for Request instance
                for arg in args:
                    if isinstance(arg, (Request, StarletteRequest)):
                        req = arg
                        break
            
            # If still no request, skip permission check (direct function call in tests)
            if not req:
                return await func(*args, **kwargs)
            
            ctx = get_actor_context(req)
            
            # Check permission
            if not has_permission(req, list(allowed_roles)):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "insufficient_permissions",
                        "message": f"Role '{ctx['role']}' not permitted. Required: {', '.join(allowed_roles)}",
                        "required_roles": list(allowed_roles),
                        "current_role": ctx["role"]
                    }
                )
            
            return await func(*args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, request: Request = None, **kwargs):
            # Resolve request object
            req = request
            if not req:
                req = kwargs.pop("request", None)
            if not req:
                # Fallback: scan args for Request instance
                for arg in args:
                    if isinstance(arg, (Request, StarletteRequest)):
                        req = arg
                        break
            
            # If still no request, skip permission check (direct function call in tests)
            if not req:
                return func(*args, **kwargs)
            
            ctx = get_actor_context(req)
            
            # Check permission
            if not has_permission(req, list(allowed_roles)):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "insufficient_permissions",
                        "message": f"Role '{ctx['role']}' not permitted. Required: {', '.join(allowed_roles)}",
                        "required_roles": list(allowed_roles),
                        "current_role": ctx["role"]
                    }
                )
            
            # Phase 7.33: Pass request through to wrapped function for request_id access
            return func(*args, request=req, **kwargs)
        
        # Return appropriate wrapper based on whether function is async
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def check_permission_or_raise(request: Request, required_roles: List[str], action: str = "this action"):
    """
    Check permission and raise HTTPException(403) if denied.
    
    Useful for inline permission checks within endpoint logic.
    
    Args:
        request: FastAPI Request object
        required_roles: List of roles that have permission
        action: Description of the action being protected (for error message)
        
    Raises:
        HTTPException(403): If permission denied
        
    Example:
        def my_endpoint(request: Request):
            check_permission_or_raise(request, ['admin'], 'export audit trail')
            # Continue with privileged logic
    """
    ctx = get_actor_context(request)
    
    if not has_permission(request, required_roles):
        raise HTTPException(
            status_code=403,
            detail={
                "error": "insufficient_permissions",
                "message": f"Role '{ctx['role']}' not permitted for {action}. Required: {', '.join(required_roles)}",
                "required_roles": required_roles,
                "current_role": ctx["role"],
                "action": action
            }
        )
