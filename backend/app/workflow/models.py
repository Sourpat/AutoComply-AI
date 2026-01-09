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
    """
    NEW = "new"
    IN_REVIEW = "in_review"
    NEEDS_INFO = "needs_info"
    APPROVED = "approved"
    BLOCKED = "blocked"
    CLOSED = "closed"


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
