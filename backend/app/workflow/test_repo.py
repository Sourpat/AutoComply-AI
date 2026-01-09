"""
Workflow Console - Repository Tests

Step 2.9: Backend Persistence Layer Testing

Tests for in-memory repository operations.
Run with: pytest backend/app/workflow/test_repo.py -v
"""

import pytest
from datetime import datetime, timedelta

from .models import (
    CaseStatus,
    AuditEventType,
    EvidenceItem,
    CaseCreateInput,
    CaseUpdateInput,
    CaseListFilters,
    AuditEventCreateInput,
)
from .repo import (
    create_case,
    get_case,
    list_cases,
    update_case,
    delete_case,
    add_audit_event,
    list_audit_events,
    upsert_evidence,
    reset_store,
    get_store_stats,
)


@pytest.fixture(autouse=True)
def reset_data():
    """Reset store before each test."""
    reset_store()
    yield
    reset_store()


# ============================================================================
# Case Creation Tests
# ============================================================================

def test_create_case_basic():
    """Test creating a basic case."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Smith - CSF Application",
        summary="CSF application for Dr. Sarah Smith"
    ))
    
    assert case.id is not None
    assert case.decisionType == "csf_practitioner"
    assert case.title == "Dr. Smith - CSF Application"
    assert case.summary == "CSF application for Dr. Sarah Smith"
    assert case.status == CaseStatus.NEW
    assert case.assignedTo is None
    assert case.notesCount == 0
    assert case.attachmentsCount == 0


def test_create_case_with_submission():
    """Test creating a case linked to a submission."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Smith - CSF Application",
        submissionId="sub-12345"
    ))
    
    assert case.submissionId == "sub-12345"


def test_create_case_with_evidence():
    """Test creating a case with initial evidence."""
    evidence = [
        EvidenceItem(
            id="ev-1",
            title="OAC 4723-9-10",
            snippet="Requirements for CSF practitioners...",
            citation="OAC 4723-9-10",
            sourceId="doc-123",
            tags=["Ohio", "CSF", "Practitioner"],
            includedInPacket=True
        ),
        EvidenceItem(
            id="ev-2",
            title="Federal CSF Guidelines",
            snippet="Federal requirements...",
            citation="21 CFR 1301",
            sourceId="doc-456",
            tags=["Federal", "CSF"],
            includedInPacket=False
        )
    ]
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Smith - CSF Application",
        evidence=evidence
    ))
    
    assert len(case.evidence) == 2
    assert len(case.packetEvidenceIds) == 1  # Only ev-1 included
    assert "ev-1" in case.packetEvidenceIds


def test_create_case_with_due_date():
    """Test creating a case with SLA deadline."""
    due_date = datetime.utcnow() + timedelta(hours=24)
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Smith - CSF Application",
        dueAt=due_date
    ))
    
    assert case.dueAt == due_date


# ============================================================================
# Case Retrieval Tests
# ============================================================================

def test_get_case_exists():
    """Test retrieving an existing case."""
    created = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    retrieved = get_case(created.id)
    
    assert retrieved is not None
    assert retrieved.id == created.id
    assert retrieved.title == "Test Case"


def test_get_case_not_found():
    """Test retrieving a non-existent case."""
    retrieved = get_case("nonexistent-id")
    assert retrieved is None


def test_list_cases_all():
    """Test listing all cases."""
    create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    create_case(CaseCreateInput(decisionType="ohio_tddd", title="Case 2"))
    create_case(CaseCreateInput(decisionType="csf_hospital", title="Case 3"))
    
    cases = list_cases()
    
    assert len(cases) == 3


def test_list_cases_filter_by_status():
    """Test filtering cases by status."""
    case1 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    case2 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 2"))
    
    # Update one to IN_REVIEW
    update_case(case1.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    
    new_cases = list_cases(CaseListFilters(status=CaseStatus.NEW))
    review_cases = list_cases(CaseListFilters(status=CaseStatus.IN_REVIEW))
    
    assert len(new_cases) == 1
    assert len(review_cases) == 1
    assert review_cases[0].id == case1.id


def test_list_cases_filter_by_assigned():
    """Test filtering cases by assignee."""
    case1 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Case 1",
        assignedTo="verifier@example.com"
    ))
    case2 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Case 2"
    ))
    
    assigned = list_cases(CaseListFilters(assignedTo="verifier@example.com"))
    
    assert len(assigned) == 1
    assert assigned[0].id == case1.id


def test_list_cases_filter_unassigned():
    """Test filtering unassigned cases."""
    case1 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Case 1",
        assignedTo="verifier@example.com"
    ))
    case2 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Case 2"
    ))
    
    unassigned = list_cases(CaseListFilters(unassigned=True))
    
    assert len(unassigned) == 1
    assert unassigned[0].id == case2.id


def test_list_cases_filter_by_decision_type():
    """Test filtering cases by decision type."""
    create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    create_case(CaseCreateInput(decisionType="ohio_tddd", title="Case 2"))
    create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 3"))
    
    csf_cases = list_cases(CaseListFilters(decisionType="csf_practitioner"))
    
    assert len(csf_cases) == 2


def test_list_cases_filter_by_search():
    """Test text search in title/summary."""
    create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Smith - CSF Application",
        summary="Application for Sarah Smith"
    ))
    create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Jones - CSF Application",
        summary="Application for Bob Jones"
    ))
    
    smith_cases = list_cases(CaseListFilters(search="Smith"))
    jones_cases = list_cases(CaseListFilters(search="Jones"))
    
    assert len(smith_cases) == 1
    assert len(jones_cases) == 1
    assert "Smith" in smith_cases[0].title


def test_list_cases_filter_overdue():
    """Test filtering overdue cases."""
    past_due = datetime.utcnow() - timedelta(hours=1)
    future_due = datetime.utcnow() + timedelta(hours=1)
    
    case1 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Overdue Case",
        dueAt=past_due
    ))
    case2 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Not Overdue Case",
        dueAt=future_due
    ))
    
    overdue_cases = list_cases(CaseListFilters(overdue=True))
    
    assert len(overdue_cases) == 1
    assert overdue_cases[0].id == case1.id


def test_list_cases_sorted_by_created():
    """Test cases are sorted by creation date (newest first)."""
    case1 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    case2 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 2"))
    case3 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 3"))
    
    cases = list_cases()
    
    assert cases[0].id == case3.id  # Newest first
    assert cases[1].id == case2.id
    assert cases[2].id == case1.id


# ============================================================================
# Case Update Tests
# ============================================================================

def test_update_case_status():
    """Test updating case status."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    updated = update_case(case.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    
    assert updated is not None
    assert updated.status == CaseStatus.IN_REVIEW
    assert updated.updatedAt > case.updatedAt


def test_update_case_assignment():
    """Test assigning a case."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    updated = update_case(case.id, CaseUpdateInput(assignedTo="verifier@example.com"))
    
    assert updated is not None
    assert updated.assignedTo == "verifier@example.com"


def test_update_case_multiple_fields():
    """Test updating multiple fields at once."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    updated = update_case(case.id, CaseUpdateInput(
        status=CaseStatus.IN_REVIEW,
        assignedTo="verifier@example.com",
        notesCount=3,
        attachmentsCount=2
    ))
    
    assert updated is not None
    assert updated.status == CaseStatus.IN_REVIEW
    assert updated.assignedTo == "verifier@example.com"
    assert updated.notesCount == 3
    assert updated.attachmentsCount == 2


def test_update_case_not_found():
    """Test updating a non-existent case."""
    updated = update_case("nonexistent-id", CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    assert updated is None


# ============================================================================
# Case Deletion Tests
# ============================================================================

def test_delete_case():
    """Test deleting a case."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    deleted = delete_case(case.id)
    
    assert deleted is True
    assert get_case(case.id) is None


def test_delete_case_not_found():
    """Test deleting a non-existent case."""
    deleted = delete_case("nonexistent-id")
    assert deleted is False


# ============================================================================
# Audit Event Tests
# ============================================================================

def test_add_audit_event():
    """Test adding an audit event."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    event = add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.CASE_CREATED,
        actor="system",
        message="Case created",
        meta={"source": "api"}
    ))
    
    assert event.id is not None
    assert event.caseId == case.id
    assert event.eventType == AuditEventType.CASE_CREATED
    assert event.actor == "system"
    assert event.message == "Case created"
    assert event.meta["source"] == "api"


def test_list_audit_events():
    """Test listing audit events for a case."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.CASE_CREATED,
        message="Case created"
    ))
    
    add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.STATUS_CHANGED,
        message="Status changed",
        meta={"old_status": "new", "new_status": "in_review"}
    ))
    
    events = list_audit_events(case.id)
    
    assert len(events) == 2
    assert events[0].eventType == AuditEventType.STATUS_CHANGED  # Newest first
    assert events[1].eventType == AuditEventType.CASE_CREATED


def test_list_audit_events_empty():
    """Test listing events for case with no events."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    events = list_audit_events(case.id)
    assert len(events) == 0


# ============================================================================
# Evidence Management Tests
# ============================================================================

def test_upsert_evidence_replace():
    """Test replacing all evidence."""
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    new_evidence = [
        EvidenceItem(
            id="ev-1",
            title="Document 1",
            snippet="Snippet 1",
            citation="Citation 1",
            sourceId="doc-1"
        ),
        EvidenceItem(
            id="ev-2",
            title="Document 2",
            snippet="Snippet 2",
            citation="Citation 2",
            sourceId="doc-2"
        )
    ]
    
    updated = upsert_evidence(case.id, evidence=new_evidence)
    
    assert updated is not None
    assert len(updated.evidence) == 2
    assert updated.evidence[0].id == "ev-1"


def test_upsert_evidence_update_packet():
    """Test updating packet evidence IDs only."""
    evidence = [
        EvidenceItem(
            id="ev-1",
            title="Document 1",
            snippet="Snippet 1",
            citation="Citation 1",
            sourceId="doc-1"
        ),
        EvidenceItem(
            id="ev-2",
            title="Document 2",
            snippet="Snippet 2",
            citation="Citation 2",
            sourceId="doc-2"
        )
    ]
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case",
        evidence=evidence
    ))
    
    # Initially all included
    assert len(case.packetEvidenceIds) == 2
    
    # Update to only include ev-1
    updated = upsert_evidence(case.id, packet_evidence_ids=["ev-1"])
    
    assert updated is not None
    assert len(updated.evidence) == 2  # Evidence unchanged
    assert len(updated.packetEvidenceIds) == 1
    assert "ev-1" in updated.packetEvidenceIds
    assert "ev-2" not in updated.packetEvidenceIds


def test_upsert_evidence_not_found():
    """Test updating evidence for non-existent case."""
    updated = upsert_evidence("nonexistent-id", evidence=[])
    assert updated is None


# ============================================================================
# Store Management Tests
# ============================================================================

def test_get_store_stats():
    """Test getting storage statistics."""
    create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    case2 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 2"))
    update_case(case2.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    
    add_audit_event(AuditEventCreateInput(
        caseId=case2.id,
        eventType=AuditEventType.CASE_CREATED
    ))
    
    stats = get_store_stats()
    
    assert stats["case_count"] == 2
    assert stats["total_events"] == 1
    assert stats["cases_by_status"]["new"] == 1
    assert stats["cases_by_status"]["in_review"] == 1


def test_reset_store():
    """Test resetting the store."""
    create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 2"))
    
    reset_store()
    
    cases = list_cases()
    assert len(cases) == 0
    
    stats = get_store_stats()
    assert stats["case_count"] == 0
    assert stats["total_events"] == 0
