"""
Workflow Console Backend Module

Step 2.9: Backend Persistence APIs for Workflow Console

Provides in-memory persistence for:
- Case records (work queue items)
- Audit events (timeline tracking)
- Evidence management (RAG evidence + packet curation)

This is v1 with in-memory storage. Future versions will add database persistence.
"""

from .models import (
    CaseStatus,
    AuditEventType,
    EvidenceItem,
    CaseRecord,
    AuditEvent,
    CaseCreateInput,
    CaseUpdateInput,
    CaseListFilters,
)
from .repo import (
    create_case,
    list_cases,
    get_case,
    update_case,
    add_audit_event,
    list_audit_events,
    upsert_evidence,
)

__all__ = [
    # Enums
    "CaseStatus",
    "AuditEventType",
    # Models
    "EvidenceItem",
    "CaseRecord",
    "AuditEvent",
    "CaseCreateInput",
    "CaseUpdateInput",
    "CaseListFilters",
    # Repository functions
    "create_case",
    "list_cases",
    "get_case",
    "update_case",
    "add_audit_event",
    "list_audit_events",
    "upsert_evidence",
]
