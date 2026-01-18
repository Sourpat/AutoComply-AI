"""
Workflow Console - Pydantic Models

Step 2.9: Backend Persistence Layer

Defines data models for case management, audit tracking, and evidence curation.
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List, Generic, TypeVar
from pydantic import BaseModel, Field

# Generic type for pagination
T = TypeVar('T')


# ============================================================================
# Pagination
# ============================================================================

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""
    items: List[T]
    total: int
    limit: int
    offset: int


# ============================================================================
# Enums
# ============================================================================

class CaseStatus(str, Enum):
    """
    Case workflow status matching frontend UI states.
    
    Workflow progression:
    NEW -> IN_REVIEW -> NEEDS_INFO (optional loop) -> APPROVED/BLOCKED -> CLOSED
    
    Special status:
    CANCELLED -> Submission was deleted by submitter
    """
    NEW = "new"
    IN_REVIEW = "in_review"
    NEEDS_INFO = "needs_info"
    APPROVED = "approved"
    BLOCKED = "blocked"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class AuditEventType(str, Enum):
    """
    Audit event types for timeline tracking.
    
    Covers all Phase 2 workflow actions:
    - Submission intake
    - Status transitions
    - Assignment changes
    - Evidence attachment
    - Notes and metadata
    - Bulk operations
    - Export and admin operations
    """
    SUBMISSION_RECEIVED = "submission_received"
    CASE_CREATED = "case_created"
    STATUS_CHANGED = "status_changed"
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    EVIDENCE_ATTACHED = "evidence_attached"
    EVIDENCE_REMOVED = "evidence_removed"
    EVIDENCE_REDACTED = "evidence_redacted"
    NOTE_ADDED = "note_added"
    PACKET_UPDATED = "packet_updated"
    REQUESTED_INFO = "requested_info"
    BULK_ACTION = "bulk_action"
    EXPORTED = "exported"
    COMMENT_ADDED = "comment_added"


# ============================================================================
# Evidence Models
# ============================================================================

class EvidenceItem(BaseModel):
    """
    RAG evidence item with packet curation support.
    
    Fields:
    - id: Unique identifier (UUID)
    - title: Document title
    - snippet: Relevant excerpt/snippet
    - citation: Legal citation (e.g., "OAC 4723-9-10")
    - sourceId: Source document ID for RAG linking
    - tags: Classification tags (jurisdiction, topic, etc.)
    - metadata: Additional context (confidence, page number, etc.)
    - includedInPacket: Whether included in export packet
    """
    id: str = Field(..., description="Unique evidence item ID")
    title: str = Field(..., description="Document title")
    snippet: str = Field(..., description="Relevant text excerpt")
    citation: str = Field(..., description="Legal citation reference")
    sourceId: str = Field(..., description="Source document ID")
    tags: List[str] = Field(default_factory=list, description="Classification tags")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    includedInPacket: bool = Field(default=True, description="Include in export packet")


class EvidenceUploadItem(BaseModel):
    """
    Evidence upload metadata for submitter attachments.
    """
    id: str = Field(..., description="Evidence UUID")
    caseId: str = Field(..., alias="case_id", description="Parent case ID")
    submissionId: str = Field(..., alias="submission_id", description="Parent submission ID")
    filename: str = Field(..., description="Original filename")
    contentType: str = Field(..., alias="content_type", description="MIME content type")
    sizeBytes: int = Field(..., alias="size_bytes", description="File size in bytes")
    storagePath: str = Field(..., alias="storage_path", description="Relative storage path")
    sha256: str | None = Field(None, description="SHA256 hash")
    uploadedBy: str | None = Field(None, alias="uploaded_by", description="Uploader identity")
    createdAt: str = Field(..., alias="created_at", description="Created timestamp (ISO UTC)")

    class Config:
        populate_by_name = True


class AttachmentItem(BaseModel):
    id: str
    caseId: str = Field(..., alias="case_id")
    submissionId: str | None = Field(None, alias="submission_id")
    filename: str
    contentType: str = Field(..., alias="content_type")
    sizeBytes: int = Field(..., alias="size_bytes")
    storagePath: str = Field(..., alias="storage_path")
    uploadedBy: str | None = Field(None, alias="uploaded_by")
    description: str | None = None
    isDeleted: int = Field(0, alias="is_deleted")
    deletedAt: str | None = Field(None, alias="deleted_at")
    deletedBy: str | None = Field(None, alias="deleted_by")
    deleteReason: str | None = Field(None, alias="delete_reason")
    isRedacted: int = Field(0, alias="is_redacted")
    redactedAt: str | None = Field(None, alias="redacted_at")
    redactedBy: str | None = Field(None, alias="redacted_by")
    redactReason: str | None = Field(None, alias="redact_reason")
    originalSha256: str | None = Field(None, alias="original_sha256")
    createdAt: str = Field(..., alias="created_at")

    class Config:
        populate_by_name = True


# ============================================================================
# Case Models
# ============================================================================

class CaseRecord(BaseModel):
    """
    Complete case record for work queue management.
    
    Core Fields:
    - id: Case UUID
    - createdAt: ISO timestamp
    - updatedAt: ISO timestamp
    - decisionType: Decision type key (csf_practitioner, ohio_tddd, etc.)
    - title: Display title
    - summary: Brief description
    - status: Current workflow status
    - assignedTo: Assigned user (name or ID)
    - dueAt: SLA deadline (ISO timestamp)
    - submissionId: Link to submission record
    - resolvedAt: Resolution timestamp (ISO, when approved/rejected)
    
    Evidence & Metadata:
    - evidence: List of attached RAG evidence items
    - packetEvidenceIds: IDs of evidence included in export packet
    - notesCount: Number of internal notes
    - attachmentsCount: Number of file attachments
    """
    # Core identification
    id: str = Field(..., description="Case UUID")
    createdAt: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updatedAt: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")
    
    # Case metadata
    decisionType: str = Field(..., description="Decision type key")
    title: str = Field(..., description="Display title")
    summary: Optional[str] = Field(None, description="Brief description")
    
    # Workflow status
    status: CaseStatus = Field(default=CaseStatus.NEW, description="Current status")
    assignedTo: Optional[str] = Field(None, description="Assigned user name or ID")
    resolvedAt: Optional[datetime] = Field(None, description="Resolution timestamp")
    
    # SLA tracking
    dueAt: Optional[datetime] = Field(None, description="SLA deadline")
    
    # Submission linkage
    submissionId: Optional[str] = Field(None, description="Linked submission ID")
    
    # Evidence management
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Attached evidence items")
    packetEvidenceIds: List[str] = Field(default_factory=list, description="Evidence IDs included in packet")
    
    # Counters (computed from related data)
    notesCount: Optional[int] = Field(0, description="Number of internal notes")
    attachmentsCount: Optional[int] = Field(0, description="Number of file attachments")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CaseCreateInput(BaseModel):
    """
    Input model for creating a new case.
    
    Required fields:
    - decisionType: Decision type key
    - title: Display title
    
    Optional fields:
    - summary: Brief description
    - submissionId: Link to submission
    - assignedTo: Pre-assign to user
    - dueAt: Custom SLA deadline
    - evidence: Initial evidence items
    """
    decisionType: str = Field(..., description="Decision type key")
    title: str = Field(..., description="Display title")
    summary: Optional[str] = Field(None, description="Brief description")
    submissionId: Optional[str] = Field(None, description="Linked submission ID")
    assignedTo: Optional[str] = Field(None, description="Pre-assign to user")
    dueAt: Optional[datetime] = Field(None, description="Custom SLA deadline")
    evidence: List[EvidenceItem] = Field(default_factory=list, description="Initial evidence")


class CaseUpdateInput(BaseModel):
    """
    Input model for updating case fields.
    
    All fields optional - only provided fields will be updated.
    """
    title: Optional[str] = Field(None, description="Update title")
    summary: Optional[str] = Field(None, description="Update summary")
    status: Optional[CaseStatus] = Field(None, description="Update status")
    assignedTo: Optional[str] = Field(None, description="Update assignee")
    dueAt: Optional[datetime] = Field(None, description="Update SLA deadline")
    resolvedAt: Optional[datetime] = Field(None, description="Update resolution timestamp")
    notesCount: Optional[int] = Field(None, description="Update notes count")
    attachmentsCount: Optional[int] = Field(None, description="Update attachments count")


class CaseListFilters(BaseModel):
    """
    Query filters for listing cases.
    
    Supports filtering by:
    - status: Filter by workflow status
    - assignedTo: Filter by assignee
    - decisionType: Filter by decision type
    - search: Text search in title/summary
    - overdue: Only show overdue cases
    - unassigned: Only show unassigned cases
    """
    status: Optional[CaseStatus] = Field(None, description="Filter by status")
    assignedTo: Optional[str] = Field(None, description="Filter by assignee")
    decisionType: Optional[str] = Field(None, description="Filter by decision type")
    search: Optional[str] = Field(None, description="Search in title/summary")
    overdue: Optional[bool] = Field(None, description="Show only overdue cases")
    unassigned: Optional[bool] = Field(None, description="Show only unassigned cases")


# ============================================================================
# Audit Event Models
# ============================================================================

class AuditEvent(BaseModel):
    """
    Audit event for timeline tracking.
    
    Fields:
    - id: Event UUID
    - caseId: Parent case ID
    - createdAt: Event timestamp
    - actor: User who triggered event (name or ID)
    - source: Event source (system, api, user_action)
    - eventType: Type of event
    - message: Human-readable description
    - meta: Additional structured metadata
    """
    id: str = Field(..., description="Event UUID")
    caseId: str = Field(..., description="Parent case ID")
    createdAt: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    actor: Optional[str] = Field(None, description="User who triggered event")
    source: Optional[str] = Field("system", description="Event source")
    eventType: AuditEventType = Field(..., description="Event type")
    message: Optional[str] = Field(None, description="Human-readable message")
    meta: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AuditEventCreateInput(BaseModel):
    """
    Input model for creating audit events.
    
    Required:
    - caseId: Parent case ID
    - eventType: Type of event
    
    Optional:
    - actor: User who triggered event
    - source: Event source
    - message: Description
    - meta: Additional metadata
    """
    caseId: str = Field(..., description="Parent case ID")
    eventType: AuditEventType = Field(..., description="Event type")
    actor: Optional[str] = Field(None, description="User who triggered event")
    source: Optional[str] = Field("system", description="Event source")
    message: Optional[str] = Field(None, description="Human-readable message")
    meta: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================================================
# Phase 2: Case Lifecycle Models
# ============================================================================

class CaseNote(BaseModel):
    """
    Case note for internal communication.
    
    Fields:
    - id: Note UUID
    - caseId: Parent case ID
    - createdAt: Creation timestamp
    - authorRole: Author role (admin, reviewer, system)
    - authorName: Author name (nullable for system notes)
    - noteText: Note content
    - metadata: Additional context
    """
    id: str = Field(..., description="Note UUID")
    caseId: str = Field(..., description="Parent case ID")
    createdAt: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    authorRole: str = Field(..., description="Author role")
    authorName: Optional[str] = Field(None, description="Author name")
    noteText: str = Field(..., description="Note content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CaseNoteCreateInput(BaseModel):
    """
    Input model for creating case notes.
    
    Required:
    - noteText: Note content
    
    Optional:
    - authorRole: Default "reviewer"
    - authorName: Extracted from request context
    - metadata: Additional context
    """
    noteText: str = Field(..., description="Note content", min_length=1)
    authorRole: Optional[str] = Field("reviewer", description="Author role")
    authorName: Optional[str] = Field(None, description="Author name")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")


class CaseEvent(BaseModel):
    """
    Case event for lifecycle tracking (Phase 3.1: Verifier Actions Timeline).
    
    Fields:
    - id: Event UUID
    - case_id: Parent case ID
    - created_at: Event timestamp (ISO UTC)
    - event_type: Type of event (case_created, assigned, status_changed, etc.)
    - actor_role: Actor role (verifier, submitter, system)
    - actor_id: Actor ID or email (null for system events)
    - message: Human-readable description (optional)
    - payload_json: Structured event data as JSON string
    
    Event Types:
    - case_created: Case was created from submission
    - assigned: Case assigned to verifier
    - unassigned: Case unassigned
    - status_changed: Status transition (new -> in_review, etc.)
    - submission_updated: Submitter edited their submission
    - submission_cancelled: Submitter deleted submission
    - note_added: Note added to case
    - evidence_attached: Evidence item added
    """
    id: str = Field(..., description="Event UUID")
    case_id: str = Field(..., alias="caseId", description="Parent case ID")
    created_at: str = Field(..., alias="createdAt", description="Event timestamp (ISO UTC)")
    event_type: str = Field(..., alias="eventType", description="Event type")
    actor_role: str = Field(..., alias="actorRole", description="Actor role (verifier|submitter|system)")
    actor_id: Optional[str] = Field(None, alias="actorId", description="Actor ID or email")
    message: Optional[str] = Field(None, alias="eventDetail", description="Human-readable description")
    payload_json: Optional[str] = Field(None, alias="payloadJson", description="Event payload as JSON string")
    
    class Config:
        populate_by_name = True
    
    # Properties for backward compatibility with tests using camelCase
    @property
    def eventType(self) -> str:
        return self.event_type
    
    @property
    def eventDetail(self) -> Optional[str]:
        return self.message
    
    @property
    def actor(self) -> Optional[str]:
        """Alias for actor_id for backward compatibility."""
        return self.actor_id


class CaseDecision(BaseModel):
    """
    Case decision for approval/rejection tracking.
    
    Fields:
    - id: Decision UUID
    - caseId: Parent case ID
    - createdAt: Decision timestamp
    - decision: APPROVED or REJECTED
    - reason: Brief reason/summary
    - details: Structured details
    - decidedByRole: Decider role
    - decidedByName: Decider name
    """
    id: str = Field(..., description="Decision UUID")
    caseId: str = Field(..., description="Parent case ID")
    createdAt: datetime = Field(default_factory=datetime.utcnow, description="Decision timestamp")
    decision: str = Field(..., description="APPROVED or REJECTED")
    reason: Optional[str] = Field(None, description="Brief reason")
    details: Dict[str, Any] = Field(default_factory=dict, description="Structured details")
    decidedByRole: Optional[str] = Field(None, description="Decider role")
    decidedByName: Optional[str] = Field(None, description="Decider name")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CaseDecisionCreateInput(BaseModel):
    """
    Input model for creating case decisions.
    
    Required:
    - decision: APPROVED or REJECTED
    
    Optional:
    - reason: Brief reason
    - details: Structured details
    - decidedByRole: Default "reviewer"
    - decidedByName: Extracted from request context
    """
    decision: str = Field(..., description="APPROVED or REJECTED", pattern="^(APPROVED|REJECTED)$")
    reason: Optional[str] = Field(None, description="Brief reason")
    details: Dict[str, Any] = Field(default_factory=dict, description="Structured details")
    decidedByRole: Optional[str] = Field("reviewer", description="Decider role")
    decidedByName: Optional[str] = Field(None, description="Decider name")


class TimelineItem(BaseModel):
    """
    Combined timeline item (note or event).
    
    Fields:
    - id: Item UUID
    - caseId: Parent case ID
    - createdAt: Timestamp
    - itemType: "note" or "event"
    - authorRole: Author/actor role
    - authorName: Author/actor name
    - content: Note text or event message
    - metadata: Additional context
    """
    id: str = Field(..., description="Item UUID")
    caseId: str = Field(..., description="Parent case ID")
    createdAt: datetime = Field(..., description="Timestamp")
    itemType: str = Field(..., description="note or event")
    authorRole: Optional[str] = Field(None, description="Author/actor role")
    authorName: Optional[str] = Field(None, description="Author/actor name")
    content: str = Field(..., description="Note text or event message")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CaseRequest(BaseModel):
    """
    Case request for info from verifier to submitter.
    
    Fields:
    - id: Request UUID
    - caseId: Parent case ID
    - createdAt: Request creation timestamp (ISO 8601)
    - resolvedAt: Request resolution timestamp (ISO 8601), null if open
    - status: 'open' or 'resolved'
    - requestedBy: Verifier email/ID who requested info
    - message: Request message to submitter
    - requiredFields: List of field names that must be provided (optional)
    """
    id: str = Field(..., description="Request UUID")
    caseId: str = Field(..., alias="case_id", description="Parent case ID")
    createdAt: str = Field(..., alias="created_at", description="Request creation timestamp (ISO 8601)")
    resolvedAt: Optional[str] = Field(None, alias="resolved_at", description="Request resolution timestamp (ISO 8601)")
    status: str = Field(..., description="open or resolved")
    requestedBy: Optional[str] = Field(None, alias="requested_by", description="Verifier email/ID")
    message: str = Field(..., description="Request message")
    requiredFields: Optional[List[str]] = Field(None, description="Required field names")
    
    class Config:
        populate_by_name = True


class CaseRequestCreateInput(BaseModel):
    """
    Input model for creating case requests.
    
    Required:
    - message: Request message to submitter
    
    Optional:
    - requestedBy: Verifier email/ID (extracted from request context)
    - requiredFields: List of field names that must be provided
    """
    message: str = Field(..., description="Request message", min_length=1)
    requestedBy: Optional[str] = Field(None, description="Verifier email/ID")
    requiredFields: Optional[List[str]] = Field(None, description="Required field names")
