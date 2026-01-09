"""
Scheduled Exports Router

REST API for managing recurring export jobs.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.authz import get_role, require_admin
from .scheduled_exports_repo import (
    create_scheduled_export,
    list_scheduled_exports,
    get_scheduled_export,
    update_scheduled_export,
    delete_scheduled_export,
    mark_export_run,
)


router = APIRouter(prefix="/workflow/exports", tags=["scheduled-exports"])


# ============================================================================
# Models
# ============================================================================

class ScheduledExportCreate(BaseModel):
    """Create scheduled export request."""
    name: str = Field(..., description="Display name for the export")
    schedule: str = Field(..., description="DAILY or WEEKLY")
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    minute: int = Field(..., ge=0, le=59, description="Minute (0-59)")
    mode: str = Field(..., description="case or saved_view")
    target_id: str = Field(..., description="Case ID or view ID")
    export_type: str = Field(..., description="pdf, json, or both")
    timezone: str = Field(default="UTC", description="Timezone")
    is_enabled: bool = Field(default=True, description="Whether enabled")


class ScheduledExportUpdate(BaseModel):
    """Update scheduled export request."""
    name: Optional[str] = None
    schedule: Optional[str] = None
    hour: Optional[int] = Field(None, ge=0, le=23)
    minute: Optional[int] = Field(None, ge=0, le=59)
    timezone: Optional[str] = None
    export_type: Optional[str] = None
    is_enabled: Optional[bool] = None


class ScheduledExportResponse(BaseModel):
    """Scheduled export response."""
    id: str
    created_at: str
    updated_at: str
    name: str
    schedule: str
    hour: int
    minute: int
    timezone: str
    mode: str
    target_id: str
    export_type: str
    is_enabled: int
    last_run_at: Optional[str]
    next_run_at: Optional[str]
    owner: Optional[str]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/scheduled", response_model=List[ScheduledExportResponse])
def list_exports(request: Request):
    """
    List scheduled exports.
    
    Authorization:
    - Admin: See all exports
    - Verifier: See own exports only
    
    Returns:
        List of scheduled exports
    """
    role = get_role(request)
    
    # Verifiers see their own exports, admins see all
    owner_filter = None if role == "admin" else request.headers.get("x-user-id")
    
    exports = list_scheduled_exports(owner=owner_filter)
    return exports


@router.post("/scheduled", response_model=ScheduledExportResponse, status_code=201)
def create_export(input_data: ScheduledExportCreate, request: Request):
    """
    Create a new scheduled export.
    
    Authorization:
    - Admin only
    
    Body:
        ScheduledExportCreate with name, schedule, mode, target_id, etc.
    
    Returns:
        Created export record
    """
    require_admin(request)
    
    # Validate inputs
    if input_data.schedule not in ("DAILY", "WEEKLY"):
        raise HTTPException(status_code=400, detail="Schedule must be DAILY or WEEKLY")
    
    if input_data.mode not in ("case", "saved_view"):
        raise HTTPException(status_code=400, detail="Mode must be case or saved_view")
    
    if input_data.export_type not in ("pdf", "json", "both"):
        raise HTTPException(status_code=400, detail="Export type must be pdf, json, or both")
    
    owner = request.headers.get("x-user-id")
    
    export = create_scheduled_export(
        name=input_data.name,
        schedule=input_data.schedule,
        hour=input_data.hour,
        minute=input_data.minute,
        mode=input_data.mode,
        target_id=input_data.target_id,
        export_type=input_data.export_type,
        owner=owner,
        timezone=input_data.timezone,
        is_enabled=input_data.is_enabled,
    )
    
    return export


@router.patch("/scheduled/{export_id}", response_model=ScheduledExportResponse)
def update_export(export_id: str, input_data: ScheduledExportUpdate, request: Request):
    """
    Update a scheduled export.
    
    Authorization:
    - Admin only
    
    Path Parameters:
        export_id: Export ID
    
    Body:
        ScheduledExportUpdate with fields to update
    
    Returns:
        Updated export record
    
    Raises:
        404: Export not found
    """
    require_admin(request)
    
    # Validate inputs
    if input_data.schedule and input_data.schedule not in ("DAILY", "WEEKLY"):
        raise HTTPException(status_code=400, detail="Schedule must be DAILY or WEEKLY")
    
    if input_data.export_type and input_data.export_type not in ("pdf", "json", "both"):
        raise HTTPException(status_code=400, detail="Export type must be pdf, json, or both")
    
    export = update_scheduled_export(
        export_id=export_id,
        name=input_data.name,
        schedule=input_data.schedule,
        hour=input_data.hour,
        minute=input_data.minute,
        timezone=input_data.timezone,
        export_type=input_data.export_type,
        is_enabled=input_data.is_enabled,
    )
    
    if not export:
        raise HTTPException(status_code=404, detail=f"Export not found: {export_id}")
    
    return export


@router.delete("/scheduled/{export_id}")
def delete_export(export_id: str, request: Request):
    """
    Delete a scheduled export.
    
    Authorization:
    - Admin only
    
    Path Parameters:
        export_id: Export ID
    
    Returns:
        Success confirmation
    """
    require_admin(request)
    
    # Verify exists
    export = get_scheduled_export(export_id)
    if not export:
        raise HTTPException(status_code=404, detail=f"Export not found: {export_id}")
    
    delete_scheduled_export(export_id)
    
    return {"ok": True, "deleted_id": export_id}


@router.post("/scheduled/{export_id}/run-now")
def run_export_now(export_id: str, request: Request):
    """
    Trigger an export to run immediately.
    
    Authorization:
    - Admin only
    
    Path Parameters:
        export_id: Export ID
    
    Returns:
        Success message
    """
    require_admin(request)
    
    # Verify exists
    export = get_scheduled_export(export_id)
    if not export:
        raise HTTPException(status_code=404, detail=f"Export not found: {export_id}")
    
    # Import scheduler to trigger run
    from .scheduler import run_export_job
    
    try:
        run_export_job(export)
        return {"ok": True, "message": f"Export {export['name']} triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
