"""
Authorization Module

Header-based role authorization for AutoComply AI backend.

Roles:
- admin: Full access (bulk ops, reassignment, exports, deletes)
- verifier: Case management (status changes, notes, packet curation)

Header:
    X-AutoComply-Role: "admin" | "verifier"
    
Default: "verifier" if header absent
"""

from typing import Literal
from fastapi import Request, HTTPException, status

Role = Literal["admin", "verifier"]


def get_role(request: Request) -> Role:
    """
    Extract role from X-AutoComply-Role header.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Role ("admin" or "verifier")
        
    Default:
        "verifier" if header absent or invalid
        
    Example:
        >>> role = get_role(request)
        >>> if role == "admin":
        ...     # Allow admin-only action
    """
    role_header = request.headers.get("X-AutoComply-Role", "verifier").lower()
    
    # Validate role
    if role_header not in ["admin", "verifier"]:
        return "verifier"  # Default to verifier for invalid roles
    
    return role_header  # type: ignore


def get_actor(request: Request) -> str:
    """
    Extract actor identity from request headers.
    
    Checks for X-AutoComply-Actor header first (user identifier),
    falls back to role if not present.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        Actor identifier (user ID, email, or role)
        
    Example:
        >>> actor = get_actor(request)
        >>> # Returns "user@example.com" if header set, else "admin" or "verifier"
    """
    # Prefer explicit actor header
    actor_header = request.headers.get("X-AutoComply-Actor")
    if actor_header:
        return actor_header.strip()
    
    # Fall back to role
    return get_role(request)


def require_admin(request: Request) -> None:
    """
    Require admin role or raise 403 Forbidden.
    
    Args:
        request: FastAPI Request object
        
    Raises:
        HTTPException: 403 Forbidden if role is not admin
        
    Example:
        >>> @router.delete("/cases/{case_id}")
        >>> def delete_case(case_id: str, request: Request):
        ...     require_admin(request)
        ...     # Admin-only delete logic
    """
    role = get_role(request)
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required for this operation"
        )


def can_reassign_case(request: Request, current_assignee: str | None, new_assignee: str | None) -> bool:
    """
    Check if user can reassign a case.
    
    Rules:
    - Admin: Can reassign to anyone
    - Verifier: Can only self-assign from unassigned (null -> self)
    
    Args:
        request: FastAPI Request object
        current_assignee: Current case assignee (or None if unassigned)
        new_assignee: Proposed new assignee (or None if unassigning)
        
    Returns:
        True if reassignment allowed, False otherwise
        
    Example:
        >>> # Verifier self-assigns unassigned case
        >>> can_reassign_case(request, None, "verifier")  # True
        
        >>> # Verifier tries to assign to someone else
        >>> can_reassign_case(request, None, "other_user")  # False (needs admin)
        
        >>> # Admin reassigns to anyone
        >>> can_reassign_case(admin_request, "user1", "user2")  # True
    """
    role = get_role(request)
    
    # Admin can always reassign
    if role == "admin":
        return True
    
    # Verifier can only self-assign from unassigned
    # Since we don't have user identity yet, we treat "verifier" as the self-assignment value
    # In production, this would check request.state.user.email == new_assignee
    if current_assignee is None and new_assignee == "verifier":
        return True
    
    # All other reassignments require admin
    return False
