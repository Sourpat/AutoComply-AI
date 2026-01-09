"""
Saved Views Router

Endpoints for managing saved analytics and console views.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.core.authz import get_role, require_admin
from . import views_repo


router = APIRouter(prefix="/api/analytics/views", tags=["analytics-views"])


# ============================================================================
# Request/Response Models
# ============================================================================

class SavedViewCreate(BaseModel):
    """Request body for creating a saved view."""
    
    name: str = Field(description="Display name for the view")
    scope: str = Field(description="Scope of the view (analytics or console)")
    view_json: Dict[str, Any] = Field(description="JSON object containing filters, columns, layout")
    is_shared: bool = Field(default=False, description="Whether view is shared with all users")


class SavedViewUpdate(BaseModel):
    """Request body for updating a saved view."""
    
    name: Optional[str] = Field(None, description="Display name for the view")
    view_json: Optional[Dict[str, Any]] = Field(None, description="JSON object containing filters, columns, layout")
    is_shared: Optional[bool] = Field(None, description="Whether view is shared with all users")


class SavedViewResponse(BaseModel):
    """Response model for a saved view."""
    
    id: str
    created_at: str
    updated_at: str
    name: str
    scope: str
    view_json: Dict[str, Any]
    owner: Optional[str]
    is_shared: bool


# ============================================================================
# Endpoints
# ============================================================================

@router.get("", response_model=list[SavedViewResponse])
def list_saved_views(
    request: Request,
    scope: Optional[str] = Query(None, description="Filter by scope (analytics or console)"),
):
    """
    List saved views.
    
    Returns views owned by current user plus shared views.
    Verifiers see their own views + shared views.
    Admins see all views.
    """
    role = get_role(request)
    
    # Get owner from header or use role as fallback
    owner = request.headers.get("X-AutoComply-User")
    if not owner:
        owner = role  # Use role as owner if no user specified
    
    # Admins can see all views
    if role == "admin":
        views = views_repo.list_views(scope=scope)
    else:
        # Verifiers see their own + shared
        views = views_repo.list_views(scope=scope, owner=owner)
    
    return views


@router.post("", response_model=SavedViewResponse)
def create_saved_view(
    request: Request,
    body: SavedViewCreate,
):
    """
    Create a new saved view.
    
    Verifiers can create private views.
    Admins can create private or shared views.
    """
    role = get_role(request)
    
    # Only admins can create shared views
    if body.is_shared and role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create shared views")
    
    # Get owner from header or use role as fallback
    owner = request.headers.get("X-AutoComply-User")
    if not owner:
        owner = role  # Use role as owner if no user specified
    
    view_id = views_repo.create_view(
        name=body.name,
        scope=body.scope,
        view_json=body.view_json,
        owner=owner,
        is_shared=body.is_shared,
    )
    
    view = views_repo.get_view(view_id)
    if not view:
        raise HTTPException(status_code=500, detail="Failed to create view")
    
    return view


@router.get("/{view_id}", response_model=SavedViewResponse)
def get_saved_view(
    request: Request,
    view_id: str,
):
    """
    Get a saved view by ID.
    
    Returns 404 if not found or user doesn't have access.
    """
    role = get_role(request)
    owner = request.headers.get("X-AutoComply-User") or role
    
    view = views_repo.get_view(view_id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    
    # Check access: admins see all, verifiers see their own + shared
    if role != "admin":
        if view["owner"] != owner and not view["is_shared"]:
            raise HTTPException(status_code=404, detail="View not found")
    
    return view


@router.patch("/{view_id}", response_model=SavedViewResponse)
def update_saved_view(
    request: Request,
    view_id: str,
    body: SavedViewUpdate,
):
    """
    Update a saved view.
    
    Verifiers can update their own views.
    Admins can update any view and change is_shared status.
    """
    role = get_role(request)
    owner = request.headers.get("X-AutoComply-User") or role
    
    view = views_repo.get_view(view_id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    
    # Check ownership
    if role != "admin":
        if view["owner"] != owner:
            raise HTTPException(status_code=403, detail="Can only update your own views")
        
        # Verifiers can't change is_shared
        if body.is_shared is not None and body.is_shared != view["is_shared"]:
            raise HTTPException(status_code=403, detail="Only admins can change sharing status")
    
    # Build patch dict
    patch = {}
    if body.name is not None:
        patch["name"] = body.name
    if body.view_json is not None:
        patch["view_json"] = body.view_json
    if body.is_shared is not None:
        patch["is_shared"] = body.is_shared
    
    success = views_repo.update_view(view_id, patch)
    if not success:
        raise HTTPException(status_code=404, detail="View not found")
    
    updated_view = views_repo.get_view(view_id)
    if not updated_view:
        raise HTTPException(status_code=500, detail="Failed to update view")
    
    return updated_view


@router.delete("/{view_id}")
def delete_saved_view(
    request: Request,
    view_id: str,
):
    """
    Delete a saved view.
    
    Verifiers can delete their own views.
    Admins can delete any view.
    """
    role = get_role(request)
    owner = request.headers.get("X-AutoComply-User") or role
    
    view = views_repo.get_view(view_id)
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    
    # Check ownership
    if role != "admin":
        if view["owner"] != owner:
            raise HTTPException(status_code=403, detail="Can only delete your own views")
    
    success = views_repo.delete_view(view_id)
    if not success:
        raise HTTPException(status_code=404, detail="View not found")
    
    return {"ok": True, "deleted_id": view_id}
