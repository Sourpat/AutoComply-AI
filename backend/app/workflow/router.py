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
import logging

from app.core.authz import get_role, require_admin, can_reassign_case, get_actor
from .exporter import build_case_bundle, generate_pdf
from .adherence import get_case_adherence
from .trace_repo import get_trace_repo

logger = logging.getLogger(__name__)
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
    # Phase 2 models
    CaseNote,
    CaseNoteCreateInput,
    CaseDecision,
    CaseDecisionCreateInput,
    TimelineItem,
)
from .repo import (
    create_case,
    get_case,
    list_cases,
    update_case,
    add_audit_event,
    list_audit_events,
    upsert_evidence,
    # Phase 2 functions
    validate_status_transition,
    create_case_note,
    list_case_notes,
    get_case_timeline,
    create_case_decision,
    get_case_decision_by_case,
    create_case_event,
)


router = APIRouter(prefix="/workflow", tags=["workflow"])


# ============================================================================
# Debug Endpoint (TEMPORARY - for Phase 1 verification)
# ============================================================================

@router.get("/dev/db-info")
def get_db_info():
    """
    Debug endpoint to verify database path and data.
    
    Returns:
        Database path, working directory, and record counts
    """
    from src.config import get_settings
    from src.core.db import execute_sql
    import os
    
    settings = get_settings()
    db_path = settings.DB_PATH
    cwd = os.getcwd()
    
    # Get record counts
    try:
        cases_result = execute_sql("SELECT COUNT(*) as count FROM cases", {})
        cases_count = cases_result[0]["count"] if cases_result else 0
        
        submissions_result = execute_sql("SELECT COUNT(*) as count FROM submissions", {})
        submissions_count = submissions_result[0]["count"] if submissions_result else 0
    except Exception as e:
        cases_count = f"Error: {e}"
        submissions_count = f"Error: {e}"
    
    return {
        "db_path": db_path,
        "db_exists": os.path.exists(db_path) if isinstance(db_path, str) else False,
        "cwd": cwd,
        "cases_count": cases_count,
        "submissions_count": submissions_count,
    }


@router.get("/dev/cases-ids")
def get_cases_ids():
    """
    Debug endpoint to list first 50 case IDs and their submission IDs.
    
    Returns:
        List of {case_id, submission_id, title, created_at}
    """
    from src.core.db import execute_sql
    
    try:
        result = execute_sql("""
            SELECT id, submission_id, title, created_at
            FROM cases
            ORDER BY created_at DESC
            LIMIT 50
        """, {})
        
        return {
            "count": len(result),
            "cases": result,
        }
    except Exception as e:
        return {
            "error": str(e),
            "count": 0,
            "cases": [],
        }


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
    limit: int = Query(100, ge=1, le=1000, description="Number of items per page (default 100, max 1000)"),
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
    - limit: Number of items per page (default 100, max 1000)
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
    
    # Log for debugging
    from src.config import get_settings
    db_path = get_settings().DB_PATH
    logger.info(f"✓ GET /workflow/cases: Retrieved {len(items)}/{total} cases from DB: {db_path}")
    
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


@router.get("/cases/{case_id}/submission")
def get_case_submission(case_id: str):
    """
    Get the submission linked to a case.
    
    Path Parameters:
        case_id: Case UUID
    
    Returns:
        SubmissionRecord
    
    Raises:
        404: Case not found or no linked submission
    """
    from app.submissions.repo import get_submission
    
    # Get case to find submission_id
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    if not case.submissionId:
        raise HTTPException(status_code=404, detail=f"No submission linked to case: {case_id}")
    
    # Get submission
    submission = get_submission(case.submissionId)
    if not submission:
        raise HTTPException(status_code=404, detail=f"Submission not found: {case.submissionId}")
    
    return submission


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


# ============================================================================
# Phase 2: Case Lifecycle Endpoints
# ============================================================================

@router.patch("/cases/{case_id}")
def update_case_status(
    case_id: str,
    update_input: CaseUpdateInput,
    request: Request,
):
    """
    Update case fields (status, assignee, etc.).
    
    Validates status transitions and creates audit events.
    
    Args:
        case_id: Case UUID
        update_input: Update fields
        request: HTTP request (for actor context)
        
    Returns:
        Updated case record
        
    Raises:
        404: Case not found
        400: Invalid status transition
    """
    # Get current case
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    # Extract actor from request
    actor = get_actor(request)
    role = get_role(request)
    
    # Validate status transition if status is being updated
    if update_input.status and update_input.status != case.status:
        if not validate_status_transition(case.status, update_input.status):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {case.status.value} to {update_input.status.value}"
            )
        
        # Create status change event
        create_case_event(
            case_id=case_id,
            event_type="status_changed",
            event_payload={
                "old_status": case.status.value,
                "new_status": update_input.status.value,
            },
            actor_role=role,
            actor_name=actor,
        )
    
    # Validate assignment change if needed
    if update_input.assignedTo is not None and update_input.assignedTo != case.assignedTo:
        if not can_reassign_case(request):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to reassign cases"
            )
        
        # Create assignment event
        create_case_event(
            case_id=case_id,
            event_type="assigned" if update_input.assignedTo else "unassigned",
            event_payload={
                "old_assignee": case.assignedTo,
                "new_assignee": update_input.assignedTo,
            },
            actor_role=role,
            actor_name=actor,
        )
    
    # Update case
    updated_case = update_case(case_id, update_input)
    
    return updated_case


@router.post("/cases/{case_id}/notes", response_model=CaseNote)
def add_case_note(
    case_id: str,
    note_input: CaseNoteCreateInput,
    request: Request,
):
    """
    Add a note to a case.
    
    Creates a note and corresponding audit event.
    
    Args:
        case_id: Case UUID
        note_input: Note creation input
        request: HTTP request (for actor context)
        
    Returns:
        Created case note
        
    Raises:
        404: Case not found
    """
    # Extract actor from request if not provided
    if not note_input.authorName:
        note_input.authorName = get_actor(request)
    
    if not note_input.authorRole:
        note_input.authorRole = get_role(request)
    
    # Create note (also creates event)
    note = create_case_note(case_id, note_input)
    
    return note


@router.get("/cases/{case_id}/notes", response_model=List[CaseNote])
def get_case_notes(case_id: str):
    """
    Get all notes for a case.
    
    Returns notes ordered by creation time (descending).
    
    Args:
        case_id: Case UUID
        
    Returns:
        List of case notes
        
    Raises:
        404: Case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    notes = list_case_notes(case_id)
    return notes


@router.get("/cases/{case_id}/timeline", response_model=List[TimelineItem])
def get_case_timeline_endpoint(case_id: str):
    """
    Get combined timeline of notes and events for a case.
    
    Returns notes + events sorted by creation time (descending).
    
    Args:
        case_id: Case UUID
        
    Returns:
        List of timeline items
        
    Raises:
        404: Case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    timeline = get_case_timeline(case_id)
    return timeline


@router.post("/cases/{case_id}/decision", response_model=CaseDecision)
def make_case_decision(
    case_id: str,
    decision_input: CaseDecisionCreateInput,
    request: Request,
):
    """
    Make an approval or rejection decision on a case.
    
    Updates case status based on decision:
    - APPROVED -> status = approved
    - REJECTED -> status = blocked
    
    Args:
        case_id: Case UUID
        decision_input: Decision creation input
        request: HTTP request (for actor context)
        
    Returns:
        Created case decision
        
    Raises:
        404: Case not found
    """
    # Extract actor from request if not provided
    if not decision_input.decidedByName:
        decision_input.decidedByName = get_actor(request)
    
    if not decision_input.decidedByRole:
        decision_input.decidedByRole = get_role(request)
    
    # Create decision (also updates status and creates event)
    decision = create_case_decision(case_id, decision_input)
    
    return decision


@router.get("/cases/{case_id}/decision", response_model=CaseDecision)
def get_case_decision_endpoint(case_id: str):
    """
    Get the most recent decision for a case.
    
    Args:
        case_id: Case UUID
        
    Returns:
        Most recent case decision
        
    Raises:
        404: Case not found or no decision exists
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")
    
    decision = get_case_decision_by_case(case_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"No decision found for case: {case_id}")
    
    return decision

