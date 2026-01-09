"""
Workflow Console - FastAPI Router

Step 2.10: API Endpoints for Workflow Console

Exposes REST API for case management, audit tracking, and evidence curation.
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from io import BytesIO

from app.core.authz import get_role, require_admin, can_reassign_case, get_actor
from .exporter import build_case_bundle, generate_pdf
from .adherence import get_case_adherence
from .trace_repo import get_trace_repo
from .models import (
    CaseRecord,
    CaseCreateInput,
    CaseUpdateInput,
    CaseListFilters,
    CaseStatus,
    AuditEvent,
    AuditEventCreateInput,
    AuditEventType,
    EvidenceItem,
)
from .repo import (
    create_case,
    get_case,
    list_cases,
    update_case,
    add_audit_event,
    list_audit_events,
    upsert_evidence,
)


router = APIRouter(prefix="/workflow", tags=["workflow"])


# ============================================================================
# Health Check
# ============================================================================

@router.get("/health")
def health_check():
    """
    Health check endpoint.
    
    Returns:
        {"ok": true, "env": str, "version": str}
    """
    from src.config import get_settings
    import os
    
    settings = get_settings()
    version = os.getenv("AUTOCOMPLY_VERSION", "0.1.0")
    
    return {
        "ok": True,
        "env": settings.APP_ENV,
        "version": version
    }


# ============================================================================
# Trace Endpoints
# ============================================================================

class TraceResponse(BaseModel):
    """Response model for trace retrieval."""
    trace_id: str
    trace: dict


@router.get("/traces/{trace_id}", response_model=TraceResponse)
def get_trace(trace_id: str):
    """
    Retrieve a decision trace by ID.
    
    Path Parameters:
        trace_id: Trace identifier (UUID or custom ID)
    
    Returns:
        TraceResponse with trace_id and complete trace payload
        
    Raises:
        404: Trace not found
        
    Example:
        GET /workflow/traces/trace-abc-123
        
        Response 200:
        {
            "trace_id": "trace-abc-123",
            "trace": {
                "trace_id": "trace-abc-123",
                "engine_family": "csf",
                "decision_type": "csf_facility",
                "form": {...},
                "decision": {...}
            }
        }
    """
    trace_repo = get_trace_repo()
    trace_data = trace_repo.get_trace(trace_id)
    
    if not trace_data:
        raise HTTPException(
            status_code=404,
            detail=f"Trace not found: {trace_id}"
        )
    
    return TraceResponse(
        trace_id=trace_id,
        trace=trace_data
    )


# ============================================================================
# Case Endpoints
# ============================================================================

class PaginatedCasesResponse(BaseModel):
    """Paginated response for cases list."""
    items: List[CaseRecord]
    total: int
    limit: int
    offset: int


@router.get("/cases", response_model=PaginatedCasesResponse)
def get_workflow_cases(
    status: Optional[str] = Query(None, description="Filter by status"),
    assignedTo: Optional[str] = Query(None, description="Filter by assignee"),
    decisionType: Optional[str] = Query(None, description="Filter by decision type"),
    q: Optional[str] = Query(None, description="Search in title/summary"),
    overdue: Optional[bool] = Query(None, description="Show only overdue cases"),
    unassigned: Optional[bool] = Query(None, description="Show only unassigned cases"),
    limit: int = Query(25, ge=1, le=100, description="Number of items per page (max 100)"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    sortBy: str = Query("createdAt", description="Sort field: createdAt, dueAt, or updatedAt"),
    sortDir: str = Query("desc", description="Sort direction: asc or desc"),
):
    """
    List workflow cases with optional filtering and pagination.
    
    Query Parameters:
    - status: Filter by workflow status
    - assignedTo: Filter by assignee
    - decisionType: Filter by decision type
    - q: Text search in title/summary
    - overdue: Only show overdue cases
    - unassigned: Only show unassigned cases
    - limit: Number of items per page (default 25, max 100)
    - offset: Number of items to skip (default 0)
    - sortBy: Sort field - createdAt, dueAt, or updatedAt (default createdAt)
    - sortDir: Sort direction - asc or desc (default desc)
    
    Returns:
        PaginatedCasesResponse with items, total count, limit, and offset
    """
    # Validate sortBy field
    valid_sort_fields = ["createdAt", "dueAt", "updatedAt"]
    if sortBy not in valid_sort_fields:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sortBy: {sortBy}. Valid values: {valid_sort_fields}"
        )
    
    # Validate sortDir
    if sortDir.lower() not in ["asc", "desc"]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sortDir: {sortDir}. Valid values: asc, desc"
        )
    # Convert status string to enum if provided
    status_enum = None
    if status:
        try:
            status_enum = CaseStatus(status.lower())
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Valid values: {[s.value for s in CaseStatus]}"
            )
    
    filters = CaseListFilters(
        status=status_enum,
        assignedTo=assignedTo,
        decisionType=decisionType,
        search=q,
        overdue=overdue,
        unassigned=unassigned,
    )
    
    # Call paginated list_cases
    items, total = list_cases(
        filters=filters,
        limit=limit,
        offset=offset,
        sort_by=sortBy,
        sort_dir=sortDir.lower()
    )
    
    return PaginatedCasesResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/cases", response_model=CaseRecord, status_code=201)
def create_workflow_case(input_data: CaseCreateInput, request: Request):
    """
    Create a new workflow case.
    
    Used by submission intake pipeline to create cases from submissions.
    
    Body:
        CaseCreateInput with decisionType, title, and optional fields
    
    Returns:
        Created CaseRecord with generated ID
    """
    case = create_case(input_data)
    
    # Auto-create CASE_CREATED audit event (immutable)
    add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.CASE_CREATED,
        actor=get_actor(request),
        source=get_role(request),
        message=f"Case created: {case.title}",
        meta={
            "decisionType": case.decisionType,
            "submissionId": case.submissionId,
        }
    ))
    
    return case


@router.get("/cases/{case_id}", response_model=CaseRecord)
def get_workflow_case(case_id: str):
    """
    Get a workflow case by ID.
    
    Path Parameters:
        case_id: Case UUID
    
    Returns:
        CaseRecord
    
    Raises:
        404: Case not found
    """
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    return case


@router.patch("/cases/{case_id}", response_model=CaseRecord)
def update_workflow_case(case_id: str, updates: CaseUpdateInput, request: Request):
    """
    Update workflow case fields.
    
    Automatically creates audit events for:
    - Status changes -> status_changed
    - Assignment changes -> assigned/unassigned
    - Packet updates -> packet_updated
    
    Authorization:
    - Admin: Can update all fields including reassignment
    - Verifier: Can update status, notes; can only self-assign from unassigned
    
    Path Parameters:
        case_id: Case UUID
    
    Body:
        CaseUpdateInput with fields to update
    
    Returns:
        Updated CaseRecord
    
    Raises:
        404: Case not found
        403: Forbidden (insufficient permissions for reassignment)
    """
    # Get current case to detect changes
    current_case = get_case(case_id)
    if not current_case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Authorization: Check reassignment permissions
    if updates.assignedTo is not None and updates.assignedTo != current_case.assignedTo:
        if not can_reassign_case(request, current_case.assignedTo, updates.assignedTo):
            raise HTTPException(
                status_code=403,
                detail="Admin role required to reassign cases. Verifiers can only self-assign from unassigned cases."
            )
    
    # Snapshot current values BEFORE update (critical: get_case returns reference!)
    old_status = current_case.status
    old_assignee = current_case.assignedTo
    old_packet_ids = list(current_case.packetEvidenceIds) if current_case.packetEvidenceIds else []
    
    # Apply updates
    updated_case = update_case(case_id, updates)
    if not updated_case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Create audit events for changes (immutable - no updates/deletes allowed)
    
    # Status change
    if updates.status and updates.status != old_status:
        add_audit_event(AuditEventCreateInput(
            caseId=case_id,
            eventType=AuditEventType.STATUS_CHANGED,
            actor=get_actor(request),
            source=get_role(request),
            message=f"Status changed from {old_status.value} to {updates.status.value}",
            meta={
                "old_status": old_status.value,
                "new_status": updates.status.value,
            }
        ))
    
    # Assignment change
    if updates.assignedTo is not None and updates.assignedTo != old_assignee:
        if updates.assignedTo:
            # Assigned
            add_audit_event(AuditEventCreateInput(
                caseId=case_id,
                eventType=AuditEventType.ASSIGNED,
                actor=get_actor(request),
                source=get_role(request),
                message=f"Assigned to {updates.assignedTo}",
                meta={
                    "assignee": updates.assignedTo,
                    "previous_assignee": old_assignee,
                }
            ))
        else:
            # Unassigned
            add_audit_event(AuditEventCreateInput(
                caseId=case_id,
                eventType=AuditEventType.UNASSIGNED,
                actor=get_actor(request),
                source=get_role(request),
                message=f"Unassigned from {old_assignee}",
                meta={
                    "previous_assignee": old_assignee,
                }
            ))
    
    return updated_case


# ============================================================================
# Audit Event Endpoints
# ============================================================================

class PaginatedAuditEventsResponse(BaseModel):
    """Paginated response for audit events list."""
    items: List[AuditEvent]
    total: int
    limit: int
    offset: int


@router.get("/cases/{case_id}/audit", response_model=PaginatedAuditEventsResponse)
def get_case_audit_timeline(
    case_id: str,
    limit: int = Query(50, ge=1, le=200, description="Number of items per page (max 200)"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
):
    """
    Get audit timeline for a case with pagination.
    
    Path Parameters:
        case_id: Case UUID
    
    Query Parameters:
        limit: Number of items per page (default 50, max 200)
        offset: Number of items to skip (default 0)
    
    Returns:
        PaginatedAuditEventsResponse with items, total count, limit, and offset
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Call paginated list_audit_events
    items, total = list_audit_events(
        case_id=case_id,
        limit=limit,
        offset=offset
    )
    
    return PaginatedAuditEventsResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset
    )


@router.post("/cases/{case_id}/audit", response_model=AuditEvent, status_code=201)
def create_case_audit_event(case_id: str, input_data: AuditEventCreateInput, request: Request):
    """
    Add a custom audit event to case timeline.
    
    Used for notes, bulk actions, and custom metadata.
    
    Authorization:
    - Admin: Can add all event types
    - Verifier: Can add comments and notes
    
    Path Parameters:
        case_id: Case UUID
    
    Body:
        AuditEventCreateInput with eventType, message, and optional metadata
    
    Returns:
        Created AuditEvent
    
    Raises:
        404: Case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Ensure caseId matches path parameter
    input_data.caseId = case_id
    
    return add_audit_event(input_data)


# ============================================================================
# Playbook Adherence Endpoints
# ============================================================================

class AdherenceStep(BaseModel):
    """A playbook step with completion status."""
    id: str
    title: str
    description: str


class AdherenceRecommendation(BaseModel):
    """Recommended next action for missing step."""
    stepId: str
    stepTitle: str
    suggestedAction: str


class AdherenceResponse(BaseModel):
    """Playbook adherence metrics for a case."""
    decisionType: str
    adherencePct: float
    totalSteps: int
    completedSteps: List[AdherenceStep]
    missingSteps: List[AdherenceStep]
    recommendedNextActions: List[AdherenceRecommendation]
    message: Optional[str] = None


@router.get("/cases/{case_id}/adherence", response_model=AdherenceResponse)
def get_case_playbook_adherence(case_id: str):
    """
    Get playbook adherence metrics for a case.
    
    Calculates completion percentage based on audit events matching
    playbook step signals. Provides recommended next actions for missing steps.
    
    Path Parameters:
        case_id: Case UUID
    
    Returns:
        AdherenceResponse with metrics and recommendations
    
    Raises:
        404: Case not found
    """
    # Get adherence metrics
    adherence = get_case_adherence(case_id)
    
    if not adherence:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    return adherence


# ============================================================================
# Evidence Endpoints
# ============================================================================

class AttachEvidenceInput(BaseModel):
    """Input for attaching evidence to a case."""
    evidence: List[EvidenceItem]
    source: Optional[str] = "api"
    sourceMeta: Optional[dict] = None


@router.post("/cases/{case_id}/evidence/attach", response_model=CaseRecord)
def attach_case_evidence(case_id: str, input_data: AttachEvidenceInput):
    """
    Attach evidence to a case.
    
    Merges/overwrites case.evidence and auto-calculates packetEvidenceIds
    from includedInPacket flags.
    
    Creates audit event: evidence_attached
    
    Path Parameters:
        case_id: Case UUID
    
    Body:
        - evidence: List of EvidenceItems to attach
        - source: Evidence source (default: "api")
        - sourceMeta: Additional metadata
    
    Returns:
        Updated CaseRecord
    
    Raises:
        404: Case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Attach evidence (auto-calculates packetEvidenceIds)
    updated_case = upsert_evidence(case_id, evidence=input_data.evidence)
    if not updated_case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Create audit event (immutable)
    add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.EVIDENCE_ATTACHED,
        actor=get_actor(request),
        source=input_data.source or get_role(request),
        message=f"Attached {len(input_data.evidence)} evidence documents",
        meta={
            "evidenceCount": len(input_data.evidence),
            "packetCount": len(updated_case.packetEvidenceIds),
            "sourceMeta": input_data.sourceMeta,
        }
    ))
    
    return updated_case


@router.patch("/cases/{case_id}/evidence/packet", response_model=CaseRecord)
def update_case_evidence_packet(case_id: str, packet_evidence_ids: List[str], request: Request):
    """
    Update which evidence items are included in export packet.
    
    Creates audit event: packet_updated
    
    Authorization:
    - Admin: Can update packet selection
    - Verifier: Can update packet selection (allowed)
    
    Path Parameters:
        case_id: Case UUID
    
    Body:
        List of evidence IDs to include in packet
    
    Returns:
        Updated CaseRecord
    
    Raises:
        404: Case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Get old packet IDs for comparison
    old_packet_ids = set(case.packetEvidenceIds)
    new_packet_ids = set(packet_evidence_ids)
    
    # Update packet selection
    updated_case = upsert_evidence(case_id, packet_evidence_ids=packet_evidence_ids)
    if not updated_case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Create audit event if changed
    if old_packet_ids != new_packet_ids:
        added = new_packet_ids - old_packet_ids
        removed = old_packet_ids - new_packet_ids
        
        add_audit_event(AuditEventCreateInput(
            caseId=case_id,
            eventType=AuditEventType.PACKET_UPDATED,
            actor=get_actor(request),
            source=get_role(request),
            message=f"Updated export packet: {len(packet_evidence_ids)} items",
            meta={
                "totalItems": len(packet_evidence_ids),
                "added": list(added),
                "removed": list(removed),
            }
        ))
    
    return updated_case


# ============================================================================
# Export Endpoints (Admin Only)
# ============================================================================

@router.get("/cases/{case_id}/export/json")
def export_case_json(case_id: str, request: Request):
    """
    Export case as JSON bundle.
    
    Authorization: Admin only
    
    Path Parameters:
        case_id: Case UUID
    
    Returns:
        Complete case bundle with submission, evidence, and audit timeline
    
    Raises:
        404: Case not found
        403: Forbidden (requires admin role)
    """
    require_admin(request)
    
    # Build case bundle
    bundle = build_case_bundle(case_id)
    if not bundle:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Create audit event for export (immutable)
    add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.EXPORTED,
        actor=get_actor(request),
        source=get_role(request),
        message="Case exported as JSON",
        meta={"exportFormat": "json"}
    ))
    
    return bundle


@router.get("/cases/{case_id}/export/pdf")
def export_case_pdf(case_id: str, request: Request):
    """
    Export case as PDF packet.
    
    Authorization: Admin only
    
    Generates a complete case packet with:
    - Cover page with case metadata
    - Submission summary (if linked)
    - Decision summary (if available)
    - Packet evidence with citations and snippets
    - Audit timeline
    
    Path Parameters:
        case_id: Case UUID
    
    Returns:
        PDF file as streaming response
    
    Raises:
        404: Case not found
        403: Forbidden (requires admin role)
    """
    require_admin(request)
    
    # Build case bundle
    bundle = build_case_bundle(case_id)
    if not bundle:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Generate PDF
    pdf_bytes = generate_pdf(bundle)
    
    # Create audit event for export (immutable)
    add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.EXPORTED,
        actor=get_actor(request),
        source=get_role(request),
        message="Case exported as PDF",
        meta={"exportFormat": "pdf"}
    ))
    
    # Return as streaming response
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=case_{case_id}_packet.pdf"
        }
    )


# ============================================================================
# Bulk Operations (Admin Only)
# ============================================================================

class BulkAssignInput(BaseModel):
    """Input for bulk assignment operation."""
    caseIds: List[str]
    assignedTo: str


class BulkStatusInput(BaseModel):
    """Input for bulk status update operation."""
    caseIds: List[str]
    status: CaseStatus


@router.post("/cases/bulk/assign")
def bulk_assign_cases(input_data: BulkAssignInput, request: Request):
    """
    Bulk assign cases to a user.
    
    Authorization: Admin only
    
    Body:
        - caseIds: List of case UUIDs
        - assignedTo: User to assign cases to
    
    Returns:
        Summary of bulk operation
    
    Raises:
        403: Forbidden (requires admin role)
    """
    require_admin(request)
    
    results = {
        "total": len(input_data.caseIds),
        "success": 0,
        "failed": 0,
        "errors": [],
    }
    
    for case_id in input_data.caseIds:
        try:
            updated = update_case(case_id, CaseUpdateInput(assignedTo=input_data.assignedTo))
            if updated:
                results["success"] += 1
                
                # Add audit event (immutable)
                add_audit_event(AuditEventCreateInput(
                    caseId=case_id,
                    eventType=AuditEventType.ASSIGNED,
                    actor=get_actor(request),
                    source=get_role(request),
                    message=f"Bulk assigned to {input_data.assignedTo}",
                    meta={"bulkOperation": True}
                ))
            else:
                results["failed"] += 1
                results["errors"].append(f"Case not found: {case_id}")
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{case_id}: {str(e)}")
    
    return results


@router.post("/cases/bulk/status")
def bulk_update_status(input_data: BulkStatusInput, request: Request):
    """
    Bulk update case status.
    
    Authorization: Admin only
    
    Body:
        - caseIds: List of case UUIDs
        - status: New status for all cases
    
    Returns:
        Summary of bulk operation
    
    Raises:
        403: Forbidden (requires admin role)
    """
    require_admin(request)
    
    results = {
        "total": len(input_data.caseIds),
        "success": 0,
        "failed": 0,
        "errors": [],
    }
    
    for case_id in input_data.caseIds:
        try:
            updated = update_case(case_id, CaseUpdateInput(status=input_data.status))
            if updated:
                results["success"] += 1
                
                # Add audit event (immutable)
                add_audit_event(AuditEventCreateInput(
                    caseId=case_id,
                    eventType=AuditEventType.STATUS_CHANGED,
                    actor=get_actor(request),
                    source=get_role(request),
                    message=f"Bulk status change to {input_data.status.value}",
                    meta={"bulkOperation": True, "newStatus": input_data.status.value}
                ))
            else:
                results["failed"] += 1
                results["errors"].append(f"Case not found: {case_id}")
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{case_id}: {str(e)}")
    
    return results


# ============================================================================
# Admin Operations
# ============================================================================

@router.delete("/cases/{case_id}")
def delete_workflow_case(case_id: str, request: Request):
    """
    Delete a workflow case.
    
    Authorization: Admin only
    
    WARNING: This permanently deletes the case, all evidence, and audit events.
    CASCADE delete removes all related records.
    
    Path Parameters:
        case_id: Case UUID
    
    Returns:
        Confirmation message
    
    Raises:
        404: Case not found
        403: Forbidden (requires admin role)
    """
    require_admin(request)
    
    # Verify case exists before deleting
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Delete (CASCADE removes evidence and audit events)
    from .repo import delete_case
    deleted = delete_case(case_id)
    
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    return {
        "message": f"Case {case_id} deleted successfully",
        "caseId": case_id,
        "title": case.title,
    }


@router.post("/admin/reset-store")
def reset_workflow_store(request: Request):
    """
    Reset the entire workflow store (for testing/demos).
    
    Authorization: Admin only
    
    WARNING: This deletes ALL cases, evidence, and audit events!
    
    Returns:
        Confirmation message
    
    Raises:
        403: Forbidden (requires admin role)
    """
    require_admin(request)
    
    from .repo import reset_store, get_store_stats
    
    # Get stats before reset
    before_stats = get_store_stats()
    
    # Reset
    reset_store()
    
    return {
        "message": "Workflow store reset successfully",
        "deletedCases": before_stats["case_count"],
        "deletedEvents": before_stats["total_events"],
        "warning": "All workflow data has been permanently deleted",
    }
