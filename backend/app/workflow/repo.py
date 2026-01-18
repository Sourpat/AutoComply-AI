"""
Workflow Console - SQLite Repository

Step 2.10: SQLite Persistence Layer

Provides SQLite-backed storage for cases and audit events.
Replaces in-memory storage with persistent database operations.

Features:
- Cases with status, assignment, SLA tracking
- Evidence items linked to cases
- Case packet curation (many-to-many)
- Audit event timeline
- Thread-safe SQL operations

All function signatures preserved for backward compatibility.
"""

import uuid
import json
import re
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from src.core.db import execute_sql, execute_insert, execute_update, execute_delete

from .models import (
    CaseRecord,
    CaseCreateInput,
    CaseUpdateInput,
    CaseListFilters,
    CaseStatus,
    AuditEvent,
    AuditEventCreateInput,
    EvidenceItem,
    EvidenceUploadItem,
    AttachmentItem,
    # Phase 2 models
    CaseNote,
    CaseNoteCreateInput,
    CaseEvent,
    CaseDecision,
    CaseDecisionCreateInput,
    TimelineItem,
)


# ============================================================================
# Helper Functions
# ============================================================================

def normalize_search_text(text: Optional[str]) -> str:
    """
    Normalize text for search:
    - Trim whitespace
    - Convert to lowercase
    - Collapse multiple spaces to single space
    
    Args:
        text: Raw text to normalize
        
    Returns:
        Normalized text suitable for search indexing
        
    Example:
        >>> normalize_search_text("  John   DOE  ")
        "john doe"
    """
    if not text:
        return ""
    
    # Trim and lowercase
    normalized = text.strip().lower()
    
    # Collapse multiple whitespace to single space
    normalized = re.sub(r'\s+', ' ', normalized)
    
    return normalized


def build_searchable_text(
    title: str,
    summary: Optional[str],
    decision_type: str,
    assigned_to: Optional[str],
    submission_fields: Optional[dict] = None
) -> str:
    """
    Build normalized searchable text from case fields and optional submission data.
    
    Combines:
    - title
    - summary
    - decision_type (human-readable form)
    - assigned_to
    - Selected submission form fields (if provided)
    
    Args:
        title: Case title
        summary: Case summary
        decision_type: Decision type key
        assigned_to: Assignee name/email
        submission_fields: Optional dict with submission form_data fields
        
    Returns:
        Space-separated normalized text for full-text search
        
    Example:
        >>> build_searchable_text(
        ...     "CSF Practitioner Review",
        ...     "John Doe application",
        ...     "csf_practitioner",
        ...     "verifier@example.com",
        ...     {"practitionerName": "John Doe", "npi": "1234567890"}
        ... )
        "csf practitioner review john doe application csf practitioner verifier@example.com john doe 1234567890"
    """
    parts = []
    
    # Core case fields
    parts.append(normalize_search_text(title))
    if summary:
        parts.append(normalize_search_text(summary))
    
    # Decision type (convert underscores to spaces for better searchability)
    decision_type_readable = decision_type.replace('_', ' ')
    parts.append(normalize_search_text(decision_type_readable))
    
    if assigned_to:
        parts.append(normalize_search_text(assigned_to))
    
    # Optional submission fields (selected keys only for performance)
    if submission_fields:
        # Include common searchable fields from submissions
        searchable_keys = [
            # Practitioner fields
            "practitionerName", "firstName", "lastName", "npi", "dea",
            # Facility fields
            "facilityName", "organizationName", "ein",
            # License fields
            "licenseNumber", "pharmacistName",
            # Common fields
            "applicantName", "name", "email", "phone"
        ]
        
        for key in searchable_keys:
            value = submission_fields.get(key)
            if value:
                parts.append(normalize_search_text(str(value)))
    
    # Join with space and return
    return ' '.join(filter(None, parts))


def _row_to_case(row: Dict[str, Any]) -> CaseRecord:
    """Convert database row to CaseRecord model."""
    # Parse JSON fields
    metadata = json.loads(row.get("metadata", "{}") or "{}")
    packet_evidence_ids = json.loads(row.get("packet_evidence_ids", "[]") or "[]")
    
    # Build CaseRecord (evidence loaded separately)
    return CaseRecord(
        id=row["id"],
        createdAt=datetime.fromisoformat(row["created_at"]),
        updatedAt=datetime.fromisoformat(row["updated_at"]),
        decisionType=row["decision_type"],
        title=row["title"],
        summary=row.get("summary"),
        status=CaseStatus(row["status"]),
        priority=row.get("priority", "normal"),
        assignedTo=row.get("assigned_to"),
        assignedAt=datetime.fromisoformat(row["assigned_at"]) if row.get("assigned_at") else None,
        resolvedAt=datetime.fromisoformat(row["resolved_at"]) if row.get("resolved_at") else None,
        dueAt=datetime.fromisoformat(row["due_at"]) if row.get("due_at") else None,
        submissionId=row.get("submission_id"),
        evidence=[],  # Loaded separately if needed
        packetEvidenceIds=packet_evidence_ids,
        notesCount=metadata.get("notesCount", 0),
        attachmentsCount=metadata.get("attachmentsCount", 0),
    )


def _row_to_audit_event(row: Dict[str, Any]) -> AuditEvent:
    """Convert database row to AuditEvent model."""
    meta = json.loads(row.get("meta", "{}") or "{}")
    
    return AuditEvent(
        id=row["id"],
        caseId=row["case_id"],
        createdAt=datetime.fromisoformat(row["created_at"]),
        actor=row.get("actor_name", "System"),
        source=row.get("actor_role", "system"),
        eventType=row["event_type"],
        message=row["message"],
        meta=meta,
    )


def _row_to_evidence(row: Dict[str, Any]) -> EvidenceItem:
    """Convert database row to EvidenceItem model."""
    tags = json.loads(row.get("tags", "[]") or "[]")
    metadata = json.loads(row.get("metadata", "{}") or "{}")
    
    return EvidenceItem(
        id=row["id"],
        title=row.get("title") or "",
        snippet=row.get("snippet") or "",
        citation=row.get("citation") or "",
        sourceId=row.get("source_id") or "",
        tags=tags,
        metadata=metadata,
        includedInPacket=bool(row.get("included_in_packet", 1)),
    )


# ============================================================================
# Case Operations
# ============================================================================

def create_case(input_data: CaseCreateInput) -> CaseRecord:
    """
    Create a new case record.
    
    Args:
        input_data: Case creation input
        
    Returns:
        Created CaseRecord with generated ID and timestamps
        
    Example:
        >>> case = create_case(CaseCreateInput(
        ...     decisionType="csf_practitioner",
        ...     title="Dr. Smith - CSF Application",
        ...     submissionId="sub-123"
        ... ))
        >>> print(case.id)  # Generated UUID
    """
    case_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    # Calculate packet evidence IDs from evidence list
    packet_evidence_ids = [e.id for e in (input_data.evidence or []) if e.includedInPacket]
    
    # Store metadata
    metadata = {
        "notesCount": 0,
        "attachmentsCount": 0,
    }
    
    # Build searchable text from case fields and submission data
    submission_fields = None
    if input_data.submissionId:
        # Fetch submission form_data for search indexing
        try:
            submission_sql = "SELECT form_data FROM submissions WHERE id = :submission_id"
            submission_rows = execute_sql(submission_sql, {"submission_id": input_data.submissionId})
            if submission_rows:
                form_data_json = submission_rows[0].get("form_data", "{}")
                submission_fields = json.loads(form_data_json) if form_data_json else None
        except Exception:
            # If submission fetch fails, continue without it (don't block case creation)
            pass
    
    searchable_text = build_searchable_text(
        title=input_data.title,
        summary=input_data.summary,
        decision_type=input_data.decisionType,
        assigned_to=input_data.assignedTo,
        submission_fields=submission_fields
    )
    
    # Insert case
    execute_insert("""
        INSERT INTO cases (
            id, created_at, updated_at, decision_type, submission_id,
            title, summary, status, priority, assigned_to, assigned_at,
            sla_hours, due_at, metadata, evidence_count, packet_evidence_ids, trace_id, searchable_text
        ) VALUES (
            :id, :created_at, :updated_at, :decision_type, :submission_id,
            :title, :summary, :status, :priority, :assigned_to, :assigned_at,
            :sla_hours, :due_at, :metadata, :evidence_count, :packet_evidence_ids, :trace_id, :searchable_text
        )
    """, {
        "id": case_id,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "decision_type": input_data.decisionType,
        "submission_id": input_data.submissionId,
        "title": input_data.title,
        "summary": input_data.summary,
        "status": CaseStatus.NEW.value,
        "priority": "normal",
        "assigned_to": input_data.assignedTo,
        "assigned_at": None,
        "sla_hours": None,
        "due_at": input_data.dueAt.isoformat() if input_data.dueAt else None,
        "metadata": json.dumps(metadata),
        "evidence_count": len(input_data.evidence or []),
        "packet_evidence_ids": json.dumps(packet_evidence_ids),
        "trace_id": None,
        "searchable_text": searchable_text,
    })
    
    # Insert evidence items
    for evidence in (input_data.evidence or []):
        execute_insert("""
            INSERT INTO evidence_items (
                id, case_id, created_at, title, snippet, citation,
                source_id, tags, metadata, included_in_packet
            ) VALUES (
                :id, :case_id, :created_at, :title, :snippet, :citation,
                :source_id, :tags, :metadata, :included_in_packet
            )
        """, {
            "id": evidence.id,
            "case_id": case_id,
            "created_at": now.isoformat(),
            "title": evidence.title,
            "snippet": evidence.snippet,
            "citation": evidence.citation or "",
            "source_id": evidence.sourceId or "",
            "tags": json.dumps(evidence.tags),
            "metadata": json.dumps(evidence.metadata),
            "included_in_packet": 1 if evidence.includedInPacket else 0,
        })
        
        # Insert into packet if included
        if evidence.includedInPacket:
            execute_insert("""
                INSERT INTO case_packet (case_id, evidence_id, added_at, added_by)
                VALUES (:case_id, :evidence_id, :added_at, :added_by)
            """, {
                "case_id": case_id,
                "evidence_id": evidence.id,
                "added_at": now.isoformat(),
                "added_by": "System",
            })
    
    # Return created case
    return get_case(case_id)


def get_case(case_id: str) -> Optional[CaseRecord]:
    """
    Retrieve a case by ID.
    
    Args:
        case_id: Case UUID
        
    Returns:
        CaseRecord if found, None otherwise
        
    Example:
        >>> case = get_case("550e8400-e29b-41d4-a716-446655440000")
        >>> if case:
        ...     print(case.title)
    """
    rows = execute_sql("SELECT * FROM cases WHERE id = :id", {"id": case_id})
    if not rows:
        return None
    
    case = _row_to_case(rows[0])
    
    # Load evidence items
    evidence_rows = execute_sql(
        "SELECT * FROM evidence_items WHERE case_id = :case_id ORDER BY created_at",
        {"case_id": case_id}
    )
    case.evidence = [_row_to_evidence(row) for row in evidence_rows]
    
    return case


def get_case_by_submission_id(submission_id: str) -> Optional[CaseRecord]:
    """
    Retrieve a case by its linked submission ID.
    
    Args:
        submission_id: Submission UUID
        
    Returns:
        CaseRecord if found, None otherwise
        
    Example:
        >>> case = get_case_by_submission_id("550e8400-e29b-41d4-a716-446655440000")
    """
    rows = execute_sql(
        "SELECT * FROM cases WHERE submission_id = :submission_id LIMIT 1",
        {"submission_id": submission_id}
    )
    if not rows:
        return None
    
    return _row_to_case(rows[0])


def list_cases(
    filters: Optional[CaseListFilters] = None,
    limit: int = 25,
    offset: int = 0,
    sort_by: str = "createdAt",
    sort_dir: str = "desc"
) -> Tuple[List[CaseRecord], int]:
    """
    List cases with optional filtering and pagination.
    
    Args:
        filters: Query filters (status, assignedTo, search, etc.)
        limit: Maximum number of items to return (default 25)
        offset: Number of items to skip (default 0)
        sort_by: Sort field - createdAt, dueAt, or updatedAt (default createdAt)
        sort_dir: Sort direction - asc or desc (default desc)
        
    Returns:
        Tuple of (list of matching CaseRecords, total count)
        
    Example:
        >>> # Get first page (25 items)
        >>> items, total = list_cases(limit=25, offset=0)
        
        >>> # Get cases assigned to "verifier@example.com", page 2
        >>> items, total = list_cases(
        ...     filters=CaseListFilters(assignedTo="verifier@example.com"),
        ...     limit=25,
        ...     offset=25
        ... )
    """
    # Build query dynamically based on filters
    where_clauses = ["status != 'cancelled'"]  # Exclude cancelled cases by default
    params = {}
    
    if filters:
        if filters.status:
            where_clauses.append("status = :status")
            params["status"] = filters.status.value
            # If explicitly filtering by cancelled, remove the exclusion
            if filters.status.value == 'cancelled':
                where_clauses.remove("status != 'cancelled'")
        
        if filters.assignedTo:
            where_clauses.append("assigned_to = :assigned_to")
            params["assigned_to"] = filters.assignedTo
        
        if filters.decisionType:
            where_clauses.append("decision_type = :decision_type")
            params["decision_type"] = filters.decisionType
        
        if filters.search:
            # Normalize search query for better matching
            normalized_search = normalize_search_text(filters.search)
            
            # Search against normalized searchable_text column (includes title, summary, decision_type, assigned_to, submission fields)
            where_clauses.append("searchable_text LIKE :search")
            params["search"] = f"%{normalized_search}%"
        
        if filters.overdue:
            where_clauses.append("due_at < :now AND status NOT IN ('approved', 'blocked', 'closed', 'cancelled')")
            params["now"] = datetime.utcnow().isoformat()
        
        if filters.unassigned:
            where_clauses.append("assigned_to IS NULL")
    
    # Build WHERE clause
    where_sql = ""
    if where_clauses:
        where_sql = " WHERE " + " AND ".join(where_clauses)
    
    # Get total count with same filters (efficient - uses indexes)
    count_sql = f"SELECT COUNT(*) as total FROM cases{where_sql}"
    count_rows = execute_sql(count_sql, params)
    total = count_rows[0]["total"] if count_rows else 0
    
    # Map sort_by to database column names
    sort_column_map = {
        "createdAt": "created_at",
        "dueAt": "due_at",
        "updatedAt": "updated_at",
    }
    sort_column = sort_column_map.get(sort_by, "created_at")
    sort_direction = sort_dir.upper() if sort_dir.lower() in ["asc", "desc"] else "DESC"
    
    # Build paginated query
    sql = f"SELECT * FROM cases{where_sql} ORDER BY {sort_column} {sort_direction} LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset
    
    # Execute query
    rows = execute_sql(sql, params)
    
    # Convert to CaseRecords (without evidence for list view performance)
    cases = [_row_to_case(row) for row in rows]
    
    return cases, total


def update_case(case_id: str, updates: CaseUpdateInput) -> Optional[CaseRecord]:
    """
    Update case fields.
    
    Args:
        case_id: Case UUID
        updates: Fields to update (only provided fields are changed)
        
    Returns:
        Updated CaseRecord if found, None otherwise
        
    Example:
        >>> updated = update_case(
        ...     "550e8400-e29b-41d4-a716-446655440000",
        ...     CaseUpdateInput(
        ...         status=CaseStatus.IN_REVIEW,
        ...         assignedTo="verifier@example.com"
        ...     )
        ... )
        >>> if updated:
        ...     print(updated.status)  # CaseStatus.IN_REVIEW
    """
    # Check if case exists and get current values
    current_case = get_case(case_id)
    if not current_case:
        return None
    
    # Build update SQL dynamically
    update_dict = updates.model_dump(exclude_unset=True)
    if not update_dict:
        return current_case  # No updates
    
    # Track if searchable fields changed (need to rebuild searchable_text)
    searchable_fields_changed = any(field in update_dict for field in ["title", "summary", "assignedTo"])
    
    set_clauses = []
    params = {"id": case_id, "updated_at": datetime.utcnow().isoformat()}
    
    for field, value in update_dict.items():
        # Map Python field names to database column names
        db_field = field
        if field == "decisionType":
            db_field = "decision_type"
        elif field == "assignedTo":
            db_field = "assigned_to"
        elif field == "assignedAt":
            db_field = "assigned_at"
        elif field == "dueAt":
            db_field = "due_at"
        elif field == "resolvedAt":
            db_field = "resolved_at"
        elif field == "submissionId":
            db_field = "submission_id"
        elif field == "packetEvidenceIds":
            db_field = "packet_evidence_ids"
        
        # Handle special types
        if isinstance(value, datetime):
            params[db_field] = value.isoformat()
        elif isinstance(value, CaseStatus):
            params[db_field] = value.value
        elif field == "packetEvidenceIds":
            params[db_field] = json.dumps(value)
        else:
            params[db_field] = value
        
        set_clauses.append(f"{db_field} = :{db_field}")
    
    # Rebuild searchable_text if searchable fields changed
    if searchable_fields_changed:
        # Get submission fields if submissionId exists
        submission_fields = None
        if current_case.submissionId:
            try:
                submission_sql = "SELECT form_data FROM submissions WHERE id = :submission_id"
                submission_rows = execute_sql(submission_sql, {"submission_id": current_case.submissionId})
                if submission_rows:
                    form_data_json = submission_rows[0].get("form_data", "{}")
                    submission_fields = json.loads(form_data_json) if form_data_json else None
            except Exception:
                pass
        
        searchable_text = build_searchable_text(
            title=updates.title if updates.title is not None else current_case.title,
            summary=updates.summary if updates.summary is not None else current_case.summary,
            decision_type=current_case.decisionType,
            assigned_to=updates.assignedTo if updates.assignedTo is not None else current_case.assignedTo,
            submission_fields=submission_fields
        )
        
        set_clauses.append("searchable_text = :searchable_text")
        params["searchable_text"] = searchable_text
    
    # Always update updated_at
    set_clauses.append("updated_at = :updated_at")
    
    # Execute update
    sql = f"UPDATE cases SET {', '.join(set_clauses)} WHERE id = :id"
    execute_update(sql, params)
    
    return get_case(case_id)


def delete_case(case_id: str) -> bool:
    """
    Delete a case and its audit events.
    
    Args:
        case_id: Case UUID
        
    Returns:
        True if deleted, False if not found
        
    Example:
        >>> deleted = delete_case("550e8400-e29b-41d4-a716-446655440000")
    """
    deleted = execute_delete("DELETE FROM cases WHERE id = :id", {"id": case_id})
    # CASCADE will delete evidence_items, case_packet, and audit_events
    return deleted > 0


# ============================================================================
# Audit Event Operations
# ============================================================================
#
# IMMUTABILITY GUARANTEE:
# Audit events are append-only. No update or delete operations are provided.
# This ensures complete audit trail integrity and compliance.
#
# ============================================================================

def add_audit_event(input_data: AuditEventCreateInput) -> AuditEvent:
    """
    Add an audit event to a case timeline.
    
    Args:
        input_data: Audit event creation input
        
    Returns:
        Created AuditEvent with generated ID and timestamp
        
    Example:
        >>> event = add_audit_event(AuditEventCreateInput(
        ...     caseId="550e8400-e29b-41d4-a716-446655440000",
        ...     eventType=AuditEventType.STATUS_CHANGED,
        ...     actor="verifier@example.com",
        ...     message="Status changed to IN_REVIEW",
        ...     meta={"old_status": "new", "new_status": "in_review"}
        ... ))
    """
    event_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    message = input_data.message or f"{input_data.eventType.value} event"

    execute_insert("""
        INSERT INTO audit_events (
            id, case_id, created_at, event_type, actor_role, actor_name,
            message, submission_id, meta
        ) VALUES (
            :id, :case_id, :created_at, :event_type, :actor_role, :actor_name,
            :message, :submission_id, :meta
        )
    """, {
        "id": event_id,
        "case_id": input_data.caseId,
        "created_at": now.isoformat(),
        "event_type": input_data.eventType.value,
        "actor_role": input_data.source or "system",
        "actor_name": input_data.actor or "System",
        "message": message,
        "submission_id": None,
        "meta": json.dumps(input_data.meta or {}),
    })
    
    # Return created event
    rows = execute_sql("SELECT * FROM audit_events WHERE id = :id", {"id": event_id})
    return _row_to_audit_event(rows[0])


def list_audit_events(
    case_id: str,
    limit: int = 50,
    offset: int = 0
) -> Tuple[List[AuditEvent], int]:
    """
    List audit events for a case with pagination.
    
    Args:
        case_id: Case UUID
        limit: Maximum number of items to return (default 50)
        offset: Number of items to skip (default 0)
        
    Returns:
        Tuple of (list of AuditEvents, total count)
        
    Example:
        >>> # Get first page of events
        >>> events, total = list_audit_events(
        ...     "550e8400-e29b-41d4-a716-446655440000",
        ...     limit=50,
        ...     offset=0
        ... )
        >>> print(f"Showing {len(events)} of {total} events")
    """
    # Get total count (efficient - uses index on case_id)
    count_rows = execute_sql(
        "SELECT COUNT(*) as total FROM audit_events WHERE case_id = :case_id",
        {"case_id": case_id}
    )
    total = count_rows[0]["total"] if count_rows else 0
    
    # Get paginated results
    rows = execute_sql(
        "SELECT * FROM audit_events WHERE case_id = :case_id ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
        {"case_id": case_id, "limit": limit, "offset": offset}
    )
    events = [_row_to_audit_event(row) for row in rows]
    
    return events, total


def _row_to_evidence_upload(row: Dict[str, Any]) -> EvidenceUploadItem:
    return EvidenceUploadItem(
        id=row["id"],
        case_id=row["case_id"],
        submission_id=row.get("submission_id"),
        filename=row.get("filename") or row.get("title") or "",
        content_type=row.get("content_type") or "application/octet-stream",
        size_bytes=row.get("size_bytes") or 0,
        storage_path=row.get("storage_path") or "",
        sha256=row.get("sha256"),
        uploaded_by=row.get("uploaded_by"),
        created_at=row.get("created_at"),
    )


def create_evidence_upload(
    case_id: str,
    submission_id: str,
    filename: str,
    content_type: str,
    size_bytes: int,
    storage_path: str,
    sha256: Optional[str] = None,
    uploaded_by: Optional[str] = None,
) -> EvidenceUploadItem:
    now = datetime.utcnow().isoformat()
    evidence_id = str(uuid.uuid4())

    execute_insert(
        """
        INSERT INTO evidence_items (
            id, case_id, submission_id, created_at, title, snippet, citation,
            source_id, tags, metadata, included_in_packet,
            filename, content_type, size_bytes, storage_path, sha256, uploaded_by
        ) VALUES (
            :id, :case_id, :submission_id, :created_at, :title, :snippet, :citation,
            :source_id, :tags, :metadata, :included_in_packet,
            :filename, :content_type, :size_bytes, :storage_path, :sha256, :uploaded_by
        )
        """,
        {
            "id": evidence_id,
            "case_id": case_id,
            "submission_id": submission_id,
            "created_at": now,
            "title": filename,
            "snippet": "Uploaded file",
            "citation": None,
            "source_id": None,
            "tags": json.dumps([]),
            "metadata": json.dumps({}),
            "included_in_packet": 0,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "storage_path": storage_path,
            "sha256": sha256,
            "uploaded_by": uploaded_by,
        },
    )

    row = execute_sql("SELECT * FROM evidence_items WHERE id = :id", {"id": evidence_id})
    return _row_to_evidence_upload(row[0])


def list_evidence_uploads(case_id: str) -> List[EvidenceUploadItem]:
    rows = execute_sql(
        """
        SELECT * FROM evidence_items
        WHERE case_id = :case_id AND storage_path IS NOT NULL
        ORDER BY created_at DESC
        """,
        {"case_id": case_id},
    )
    return [_row_to_evidence_upload(row) for row in rows]


def get_evidence_upload_by_id(evidence_id: str) -> Optional[EvidenceUploadItem]:
    rows = execute_sql("SELECT * FROM evidence_items WHERE id = :id", {"id": evidence_id})
    if not rows:
        return None
    return _row_to_evidence_upload(rows[0])


def _row_to_attachment(row: Dict[str, Any]) -> AttachmentItem:
    return AttachmentItem(
        id=row["id"],
        case_id=row["case_id"],
        submission_id=row.get("submission_id"),
        filename=row["filename"],
        content_type=row["content_type"],
        size_bytes=row["size_bytes"],
        storage_path=row["storage_path"],
        uploaded_by=row.get("uploaded_by"),
        description=row.get("description"),
        is_deleted=row.get("is_deleted", 0),
        deleted_at=row.get("deleted_at"),
        deleted_by=row.get("deleted_by"),
        delete_reason=row.get("delete_reason"),
        is_redacted=row.get("is_redacted", 0),
        redacted_at=row.get("redacted_at"),
        redacted_by=row.get("redacted_by"),
        redact_reason=row.get("redact_reason"),
        original_sha256=row.get("original_sha256"),
        created_at=row["created_at"],
    )


def create_attachment(
    case_id: str,
    submission_id: Optional[str],
    filename: str,
    content_type: str,
    size_bytes: int,
    storage_path: str,
    uploaded_by: Optional[str] = None,
    description: Optional[str] = None,
    original_sha256: Optional[str] = None,
) -> AttachmentItem:
    now = datetime.utcnow().isoformat()
    attachment_id = str(uuid.uuid4())

    execute_insert(
        """
        INSERT INTO attachments (
            id, case_id, submission_id, filename, content_type, size_bytes,
            storage_path, uploaded_by, description, original_sha256, created_at
        ) VALUES (
            :id, :case_id, :submission_id, :filename, :content_type, :size_bytes,
            :storage_path, :uploaded_by, :description, :original_sha256, :created_at
        )
        """,
        {
            "id": attachment_id,
            "case_id": case_id,
            "submission_id": submission_id,
            "filename": filename,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "storage_path": storage_path,
            "uploaded_by": uploaded_by,
            "description": description,
            "original_sha256": original_sha256,
            "created_at": now,
        },
    )

    rows = execute_sql("SELECT * FROM attachments WHERE id = :id", {"id": attachment_id})
    return _row_to_attachment(rows[0])


def list_attachments(
    case_id: str,
    include_deleted: bool = False,
    include_redacted: bool = True,
) -> List[AttachmentItem]:
    where_clauses = ["case_id = :case_id"]
    params: Dict[str, Any] = {"case_id": case_id}
    if not include_deleted:
        where_clauses.append("is_deleted = 0")
    if not include_redacted:
        where_clauses.append("is_redacted = 0")

    where_sql = " AND ".join(where_clauses)
    rows = execute_sql(
        f"""
        SELECT * FROM attachments
        WHERE {where_sql}
        ORDER BY created_at DESC
        """,
        params,
    )
    return [_row_to_attachment(row) for row in rows]


def get_attachment_by_id(attachment_id: str) -> Optional[AttachmentItem]:
    rows = execute_sql("SELECT * FROM attachments WHERE id = :id", {"id": attachment_id})
    if not rows:
        return None
    return _row_to_attachment(rows[0])


def soft_delete_attachment(
    attachment_id: str,
    deleted_by: Optional[str],
    reason: str,
) -> bool:
    rows_updated = execute_update(
        """
        UPDATE attachments
        SET is_deleted = 1,
            deleted_at = :deleted_at,
            deleted_by = :deleted_by,
            delete_reason = :delete_reason
        WHERE id = :id AND is_deleted = 0
        """,
        {
            "id": attachment_id,
            "deleted_at": datetime.utcnow().isoformat(),
            "deleted_by": deleted_by,
            "delete_reason": reason,
        },
    )
    return rows_updated > 0


def redact_attachment(
    attachment_id: str,
    redacted_by: Optional[str],
    reason: str,
) -> bool:
    rows_updated = execute_update(
        """
        UPDATE attachments
        SET is_redacted = 1,
            redacted_at = :redacted_at,
            redacted_by = :redacted_by,
            redact_reason = :redact_reason
        WHERE id = :id AND is_redacted = 0 AND is_deleted = 0
        """,
        {
            "id": attachment_id,
            "redacted_at": datetime.utcnow().isoformat(),
            "redacted_by": redacted_by,
            "redact_reason": reason,
        },
    )
    return rows_updated > 0


# ============================================================================
# Evidence Operations
# ============================================================================

def upsert_evidence(
    case_id: str,
    evidence: Optional[List[EvidenceItem]] = None,
    packet_evidence_ids: Optional[List[str]] = None
) -> Optional[CaseRecord]:
    """
    Update evidence for a case.
    
    Args:
        case_id: Case UUID
        evidence: New evidence list (replaces existing if provided)
        packet_evidence_ids: IDs of evidence to include in packet (updates existing if provided)
        
    Returns:
        Updated CaseRecord if found, None otherwise
        
    Example:
        >>> # Replace all evidence
        >>> case = upsert_evidence(
        ...     "550e8400-e29b-41d4-a716-446655440000",
        ...     evidence=[
        ...         EvidenceItem(
        ...             id="ev-1",
        ...             title="OAC 4723-9-10",
        ...             snippet="...",
        ...             citation="OAC 4723-9-10",
        ...             sourceId="doc-123",
        ...         )
        ...     ]
        ... )
        
        >>> # Update packet inclusion only
        >>> case = upsert_evidence(
        ...     "550e8400-e29b-41d4-a716-446655440000",
        ...     packet_evidence_ids=["ev-1", "ev-3"]
        ... )
    """
    # Check if case exists
    if not get_case(case_id):
        return None
    
    now = datetime.utcnow()
    
    # Replace evidence list if provided
    if evidence is not None:
        # Delete existing evidence
        execute_delete("DELETE FROM evidence_items WHERE case_id = :case_id", {"case_id": case_id})
        execute_delete("DELETE FROM case_packet WHERE case_id = :case_id", {"case_id": case_id})
        
        # Insert new evidence
        for ev in evidence:
            execute_insert("""
                INSERT INTO evidence_items (
                    id, case_id, created_at, title, snippet, citation,
                    source_id, tags, metadata, included_in_packet
                ) VALUES (
                    :id, :case_id, :created_at, :title, :snippet, :citation,
                    :source_id, :tags, :metadata, :included_in_packet
                )
            """, {
                "id": ev.id,
                "case_id": case_id,
                "created_at": now.isoformat(),
                "title": ev.title,
                "snippet": ev.snippet,
                "citation": ev.citation or "",
                "source_id": ev.sourceId or "",
                "tags": json.dumps(ev.tags),
                "metadata": json.dumps(ev.metadata),
                "included_in_packet": 1 if ev.includedInPacket else 0,
            })
            
            # Add to packet if included
            if ev.includedInPacket:
                execute_insert("""
                    INSERT INTO case_packet (case_id, evidence_id, added_at, added_by)
                    VALUES (:case_id, :evidence_id, :added_at, :added_by)
                """, {
                    "case_id": case_id,
                    "evidence_id": ev.id,
                    "added_at": now.isoformat(),
                    "added_by": "System",
                })
        
        # Update packet_evidence_ids if not explicitly provided
        if packet_evidence_ids is None:
            packet_evidence_ids = [e.id for e in evidence if e.includedInPacket]
    
    # Update packet evidence IDs if explicitly provided
    if packet_evidence_ids is not None:
        # Clear existing packet
        execute_delete("DELETE FROM case_packet WHERE case_id = :case_id", {"case_id": case_id})
        
        # Add new packet items
        for ev_id in packet_evidence_ids:
            execute_insert("""
                INSERT OR IGNORE INTO case_packet (case_id, evidence_id, added_at, added_by)
                VALUES (:case_id, :evidence_id, :added_at, :added_by)
            """, {
                "case_id": case_id,
                "evidence_id": ev_id,
                "added_at": now.isoformat(),
                "added_by": "System",
            })
        
        # Update case record
        execute_update("""
            UPDATE cases 
            SET packet_evidence_ids = :packet_evidence_ids, updated_at = :updated_at
            WHERE id = :id
        """, {
            "packet_evidence_ids": json.dumps(packet_evidence_ids),
            "updated_at": now.isoformat(),
            "id": case_id,
        })
    
    # Update evidence count
    count_rows = execute_sql(
        "SELECT COUNT(*) as count FROM evidence_items WHERE case_id = :case_id",
        {"case_id": case_id}
    )
    evidence_count = count_rows[0]["count"] if count_rows else 0
    
    execute_update("""
        UPDATE cases SET evidence_count = :count, updated_at = :updated_at WHERE id = :id
    """, {
        "count": evidence_count,
        "updated_at": now.isoformat(),
        "id": case_id,
    })
    
    return get_case(case_id)


# ============================================================================
# Utility Functions
# ============================================================================

def reset_store():
    """
    Reset the entire store (for testing/demos).
    
    WARNING: This deletes all cases and audit events!
    """
    execute_delete("DELETE FROM cases", {})
    execute_delete("DELETE FROM audit_events", {})
    execute_delete("DELETE FROM evidence_items", {})
    execute_delete("DELETE FROM case_packet", {})


def get_store_stats() -> Dict[str, Any]:
    """
    Get storage statistics (for debugging/monitoring).
    
    Returns:
        Dict with case count, event count, etc.
        
    Example:
        >>> stats = get_store_stats()
        >>> print(f"Total cases: {stats['case_count']}")
    """
    case_count = execute_sql("SELECT COUNT(*) as count FROM cases", {})[0]["count"]
    event_count = execute_sql("SELECT COUNT(*) as count FROM audit_events", {})[0]["count"]
    
    # Count by status
    status_counts = {}
    for status in CaseStatus:
        count_rows = execute_sql(
            "SELECT COUNT(*) as count FROM cases WHERE status = :status",
            {"status": status.value}
        )
        status_counts[status.value] = count_rows[0]["count"] if count_rows else 0
    
    return {
        "case_count": case_count,
        "total_events": event_count,
        "cases_by_status": status_counts,
    }


# ============================================================================
# Phase 2: Case Lifecycle Functions
# ============================================================================

# Allowed status transitions map
ALLOWED_STATUS_TRANSITIONS = {
    CaseStatus.NEW: [CaseStatus.IN_REVIEW, CaseStatus.BLOCKED, CaseStatus.CLOSED],
    CaseStatus.IN_REVIEW: [CaseStatus.NEEDS_INFO, CaseStatus.APPROVED, CaseStatus.BLOCKED, CaseStatus.CLOSED],
    CaseStatus.NEEDS_INFO: [CaseStatus.IN_REVIEW, CaseStatus.BLOCKED, CaseStatus.CLOSED],
    CaseStatus.APPROVED: [CaseStatus.CLOSED],
    CaseStatus.BLOCKED: [CaseStatus.IN_REVIEW, CaseStatus.CLOSED],
    CaseStatus.CLOSED: [],  # Terminal state
}


def validate_status_transition(current_status: CaseStatus, new_status: CaseStatus) -> bool:
    """
    Validate if a status transition is allowed.
    
    Args:
        current_status: Current case status
        new_status: Desired new status
        
    Returns:
        True if transition is allowed, False otherwise
        
    Example:
        >>> validate_status_transition(CaseStatus.NEW, CaseStatus.IN_REVIEW)
        True
        >>> validate_status_transition(CaseStatus.CLOSED, CaseStatus.NEW)
        False
    """
    if current_status == new_status:
        return True
    
    allowed = ALLOWED_STATUS_TRANSITIONS.get(current_status, [])
    return new_status in allowed


def create_case_note(case_id: str, input_data: CaseNoteCreateInput) -> CaseNote:
    """
    Create a new case note.
    
    Args:
        case_id: Parent case ID
        input_data: Note creation input
        
    Returns:
        Created case note
        
    Raises:
        ValueError: If case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise ValueError(f"Case not found: {case_id}")
    
    now = datetime.utcnow()
    note_id = str(uuid.uuid4())
    
    # Insert note
    execute_insert("""
        INSERT INTO case_notes (id, case_id, created_at, author_role, author_name, note_text, metadata)
        VALUES (:id, :case_id, :created_at, :author_role, :author_name, :note_text, :metadata)
    """, {
        "id": note_id,
        "case_id": case_id,
        "created_at": now.isoformat(),
        "author_role": input_data.authorRole or "reviewer",
        "author_name": input_data.authorName,
        "note_text": input_data.noteText,
        "metadata": json.dumps(input_data.metadata),
    })
    
    # Create corresponding case event
    create_case_event(
        case_id=case_id,
        event_type="note_added",
        event_payload={"note_id": note_id, "preview": input_data.noteText[:100]},
        actor_role=input_data.authorRole or "reviewer",
        actor_name=input_data.authorName,
    )
    
    # Return created note
    return get_case_note(note_id)


def get_case_note(note_id: str) -> Optional[CaseNote]:
    """
    Get a case note by ID.
    
    Args:
        note_id: Note UUID
        
    Returns:
        Case note or None if not found
    """
    rows = execute_sql("""
        SELECT id, case_id, created_at, author_role, author_name, note_text, metadata
        FROM case_notes
        WHERE id = :id
    """, {"id": note_id})
    
    if not rows:
        return None
    
    row = rows[0]
    return CaseNote(
        id=row["id"],
        caseId=row["case_id"],
        createdAt=datetime.fromisoformat(row["created_at"]),
        authorRole=row["author_role"],
        authorName=row["author_name"],
        noteText=row["note_text"],
        metadata=json.loads(row["metadata"] or "{}"),
    )


def list_case_notes(case_id: str) -> List[CaseNote]:
    """
    List all notes for a case, ordered by creation time (descending).
    
    Args:
        case_id: Parent case ID
        
    Returns:
        List of case notes
    """
    rows = execute_sql("""
        SELECT id, case_id, created_at, author_role, author_name, note_text, metadata
        FROM case_notes
        WHERE case_id = :case_id
        ORDER BY created_at DESC
    """, {"case_id": case_id})
    
    return [
        CaseNote(
            id=row["id"],
            caseId=row["case_id"],
            createdAt=datetime.fromisoformat(row["created_at"]),
            authorRole=row["author_role"],
            authorName=row["author_name"],
            noteText=row["note_text"],
            metadata=json.loads(row["metadata"] or "{}"),
        )
        for row in rows
    ]


def create_case_event(
    case_id: str,
    event_type: str,
    actor_role: str,
    actor_id: Optional[str] = None,
    message: Optional[str] = None,
    payload_dict: Optional[Dict[str, Any]] = None,
    payload: Optional[Dict[str, Any]] = None,
    event_payload: Optional[Dict[str, Any]] = None,
) -> CaseEvent:
    """
    Create a new case event (Phase 3.1: Verifier Actions Timeline).
    
    Args:
        case_id: Parent case ID
        event_type: Event type (case_created, assigned, status_changed, etc.)
        actor_role: Actor role (verifier, submitter, system)
        actor_id: Actor ID or email (optional, null for system events)
        message: Human-readable description (optional)
        payload_dict: Structured event data (optional)
        
    Returns:
        Created case event
        
    Example:
        >>> create_case_event(
        ...     case_id="case-123",
        ...     event_type="status_changed",
        ...     actor_role="verifier",
        ...     actor_id="admin@example.com",
        ...     message="Status changed from new to in_review",
        ...     payload_dict={"from": "new", "to": "in_review"}
        ... )
    """
    now = datetime.utcnow()
    event_id = str(uuid.uuid4())
    
    resolved_payload = payload_dict
    if resolved_payload is None:
        resolved_payload = payload
    if resolved_payload is None:
        resolved_payload = event_payload

    payload_json = json.dumps(resolved_payload) if resolved_payload else None
    
    execute_insert("""
        INSERT INTO case_events (id, case_id, created_at, event_type, actor_role, actor_id, message, payload_json)
        VALUES (:id, :case_id, :created_at, :event_type, :actor_role, :actor_id, :message, :payload_json)
    """, {
        "id": event_id,
        "case_id": case_id,
        "created_at": now.isoformat(),
        "event_type": event_type,
        "actor_role": actor_role,
        "actor_id": actor_id,
        "message": message,
        "payload_json": payload_json,
    })
    
    return CaseEvent(
        id=event_id,
        case_id=case_id,
        created_at=now.isoformat(),
        event_type=event_type,
        actor_role=actor_role,
        actor_id=actor_id,
        message=message,
        payload_json=payload_json,
    )


def list_case_events(case_id: str, limit: int = 200) -> List[CaseEvent]:
    """
    List all events for a case, ordered by creation time (newest first).
    
    Args:
        case_id: Parent case ID
        limit: Maximum number of events to return (default 200)
        
    Returns:
        List of case events (newest first)
    """
    rows = execute_sql("""
        SELECT id, case_id, created_at, event_type, actor_role, actor_id, message, payload_json
        FROM case_events
        WHERE case_id = :case_id
        ORDER BY created_at DESC
        LIMIT :limit
    """, {"case_id": case_id, "limit": limit})
    
    return [
        CaseEvent(
            id=row["id"],
            case_id=row["case_id"],
            created_at=row["created_at"],
            event_type=row["event_type"],
            actor_role=row["actor_role"],
            actor_id=row["actor_id"],
            message=row["message"],
            payload_json=row["payload_json"],
        )
        for row in rows
    ]


def get_case_timeline(case_id: str) -> List[TimelineItem]:
    """
    Get combined timeline of notes and events for a case.
    
    Merges notes and events, sorted by creation time (descending).
    
    Args:
        case_id: Parent case ID
        
    Returns:
        List of timeline items (notes + events)
    """
    timeline = []
    
    # Get notes
    notes = list_case_notes(case_id)
    for note in notes:
        timeline.append(TimelineItem(
            id=note.id,
            caseId=note.caseId,
            createdAt=note.createdAt,
            itemType="note",
            authorRole=note.authorRole,
            authorName=note.authorName,
            content=note.noteText,
            metadata=note.metadata,
        ))
    
    # Get events
    events = list_case_events(case_id)
    for event in events:
        # Create human-readable content from event
        content = f"{event.eventType.replace('_', ' ').title()}"
        if event.eventPayload:
            # Add payload details to content
            if "old_status" in event.eventPayload and "new_status" in event.eventPayload:
                content = f"Status changed from {event.eventPayload['old_status']} to {event.eventPayload['new_status']}"
            elif "decision" in event.eventPayload:
                content = f"Decision: {event.eventPayload['decision']}"
        
        timeline.append(TimelineItem(
            id=event.id,
            caseId=event.caseId,
            createdAt=event.createdAt,
            itemType="event",
            authorRole=event.actorRole,
            authorName=event.actorName,
            content=content,
            metadata=event.eventPayload,
        ))
    
    # Sort by creation time (descending)
    timeline.sort(key=lambda x: x.createdAt, reverse=True)
    
    return timeline


def create_case_decision(case_id: str, input_data: CaseDecisionCreateInput) -> CaseDecision:
    """
    Create a case decision (approval or rejection).
    
    Updates case status based on decision:
    - APPROVED -> status = approved
    - REJECTED -> status = blocked
    
    Args:
        case_id: Parent case ID
        input_data: Decision creation input
        
    Returns:
        Created case decision
        
    Raises:
        ValueError: If case not found
    """
    # Verify case exists
    case = get_case(case_id)
    if not case:
        raise ValueError(f"Case not found: {case_id}")

    if case.status in {CaseStatus.CANCELLED, CaseStatus.APPROVED, CaseStatus.BLOCKED, CaseStatus.CLOSED}:
        raise ValueError("Case is already resolved or cancelled")
    
    now = datetime.utcnow()
    decision_id = str(uuid.uuid4())
    
    # Ensure only one active decision per case
    execute_update("DELETE FROM case_decisions WHERE case_id = :case_id", {"case_id": case_id})

    # Insert decision
    execute_insert("""
        INSERT INTO case_decisions (id, case_id, created_at, decision, reason, details_json, decided_by_role, decided_by_name)
        VALUES (:id, :case_id, :created_at, :decision, :reason, :details_json, :decided_by_role, :decided_by_name)
    """, {
        "id": decision_id,
        "case_id": case_id,
        "created_at": now.isoformat(),
        "decision": input_data.decision,
        "reason": input_data.reason,
        "details_json": json.dumps(input_data.details),
        "decided_by_role": input_data.decidedByRole or "reviewer",
        "decided_by_name": input_data.decidedByName,
    })
    
    # Update case status based on decision
    new_status = CaseStatus.APPROVED if input_data.decision == "APPROVED" else CaseStatus.BLOCKED
    update_case(case_id, CaseUpdateInput(status=new_status, resolvedAt=now))
    
    # Create decision event
    create_case_event(
        case_id=case_id,
        event_type="case_decision_created",
        actor_role=input_data.decidedByRole or "reviewer",
        actor_id=input_data.decidedByName,
        message=f"Decision recorded: {input_data.decision}",
        payload_dict={
            "decisionType": input_data.decision,
            "reason": input_data.reason,
            "decidedBy": input_data.decidedByName,
        },
    )
    
    # Create corresponding case event
    create_case_event(
        case_id=case_id,
        event_type="case_status_changed",
        actor_role=input_data.decidedByRole or "reviewer",
        actor_id=input_data.decidedByName,
        payload_dict={
            "from": case.status.value,
            "to": new_status.value,
        },
    )
    
    return get_case_decision(decision_id)


def get_case_decision(decision_id: str) -> Optional[CaseDecision]:
    """
    Get a case decision by ID.
    
    Args:
        decision_id: Decision UUID
        
    Returns:
        Case decision or None if not found
    """
    rows = execute_sql("""
        SELECT id, case_id, created_at, decision, reason, details_json, decided_by_role, decided_by_name
        FROM case_decisions
        WHERE id = :id
    """, {"id": decision_id})
    
    if not rows:
        return None
    
    row = rows[0]
    return CaseDecision(
        id=row["id"],
        caseId=row["case_id"],
        createdAt=datetime.fromisoformat(row["created_at"]),
        decision=row["decision"],
        reason=row["reason"],
        details=json.loads(row["details_json"] or "{}"),
        decidedByRole=row["decided_by_role"],
        decidedByName=row["decided_by_name"],
    )


# ============================================================================
# Case Requests (Phase 4.1: Request Info Loop)
# ============================================================================

def create_case_request(
    case_id: str,
    message: str,
    requested_by: Optional[str] = None,
    required_fields: Optional[List[str]] = None,
) -> str:
    """
    Create a case request for additional information.
    
    Business rules:
    - Only one OPEN request per case allowed
    - Automatically closes any previous open requests
    
    Args:
        case_id: Parent case ID
        message: Request message to submitter
        requested_by: Verifier email/ID (optional)
        required_fields: List of required field names (optional)
        
    Returns:
        New request ID (UUID)
    """
    from .models import CaseRequest
    
    # Close any existing open requests for this case
    execute_update("""
        UPDATE case_requests
        SET status = 'resolved',
            resolved_at = :resolved_at
        WHERE case_id = :case_id AND status = 'open'
    """, {
        "case_id": case_id,
        "resolved_at": datetime.utcnow().isoformat(),
    })
    
    # Create new request
    request_id = str(uuid.uuid4())
    required_fields_json = json.dumps(required_fields) if required_fields else None
    
    execute_insert("""
        INSERT INTO case_requests (
            id, case_id, created_at, status, requested_by, message, required_fields_json
        ) VALUES (
            :id, :case_id, :created_at, :status, :requested_by, :message, :required_fields_json
        )
    """, {
        "id": request_id,
        "case_id": case_id,
        "created_at": datetime.utcnow().isoformat(),
        "status": "open",
        "requested_by": requested_by,
        "message": message,
        "required_fields_json": required_fields_json,
    })
    
    return request_id


def get_open_case_request(case_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the open case request for a case, if any.
    
    Args:
        case_id: Parent case ID
        
    Returns:
        CaseRequest dict or None if no open request exists
    """
    rows = execute_sql("""
        SELECT id, case_id, created_at, resolved_at, status, requested_by, message, required_fields_json
        FROM case_requests
        WHERE case_id = :case_id AND status = 'open'
        ORDER BY created_at DESC
        LIMIT 1
    """, {"case_id": case_id})
    
    if not rows:
        return None
    
    row = rows[0]
    required_fields = json.loads(row["required_fields_json"]) if row["required_fields_json"] else None
    
    return {
        "id": row["id"],
        "caseId": row["case_id"],
        "createdAt": row["created_at"],
        "resolvedAt": row["resolved_at"],
        "status": row["status"],
        "requestedBy": row["requested_by"],
        "message": row["message"],
        "requiredFields": required_fields,
    }


def resolve_case_request(request_id: str) -> bool:
    """
    Mark a case request as resolved.
    
    Args:
        request_id: Request UUID
        
    Returns:
        True if request was resolved, False if not found or already resolved
    """
    rows_updated = execute_update("""
        UPDATE case_requests
        SET status = 'resolved',
            resolved_at = :resolved_at
        WHERE id = :id AND status = 'open'
    """, {
        "id": request_id,
        "resolved_at": datetime.utcnow().isoformat(),
    })
    
    return rows_updated > 0
def get_case_decision_by_case(case_id: str) -> Optional[CaseDecision]:
    """
    Get the most recent decision for a case.
    
    Args:
        case_id: Parent case ID
        
    Returns:
        Most recent case decision or None if no decisions exist
    """
    rows = execute_sql("""
        SELECT id, case_id, created_at, decision, reason, details_json, decided_by_role, decided_by_name
        FROM case_decisions
        WHERE case_id = :case_id
        ORDER BY created_at DESC
        LIMIT 1
    """, {"case_id": case_id})
    
    if not rows:
        return None
    
    row = rows[0]
    return CaseDecision(
        id=row["id"],
        caseId=row["case_id"],
        createdAt=datetime.fromisoformat(row["created_at"]),
        decision=row["decision"],
        reason=row["reason"],
        details=json.loads(row["details_json"] or "{}"),
        decidedByRole=row["decided_by_role"],
        decidedByName=row["decided_by_name"],
    )

