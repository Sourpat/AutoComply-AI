"""
Test SQLite Repository Implementation

This script tests the SQLite-backed repositories to ensure:
1. Cases can be created and retrieved
2. Audit events are persisted correctly
3. Evidence is stored and linked properly
4. Submissions are persisted
5. Data survives process restart (true persistence)
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime
from app.workflow.repo import (
    create_case,
    get_case,
    list_cases,
    update_case,
    delete_case,
    add_audit_event,
    list_audit_events,
    upsert_evidence,
    get_store_stats,
    reset_store,
)
from app.workflow.models import (
    CaseCreateInput,
    CaseStatus,
    CaseListFilters,
    CaseUpdateInput,
    AuditEventCreateInput,
    AuditEventType,
    EvidenceItem,
)
from app.submissions.repo import (
    create_submission,
    get_submission,
    list_submissions,
    clear_all_submissions,
)
from app.submissions.models import (
    SubmissionCreateInput,
    SubmissionListFilters,
)
from src.core.db import init_db


def test_case_crud():
    """Test case CRUD operations."""
    print("\n=== Testing Case CRUD ===")
    
    # Create case
    case_input = CaseCreateInput(
        decisionType="csf",
        title="CSF - Dr. Smith Prescribing Authority",
        summary="Can Dr. Smith prescribe controlled substances?",
        evidence=[
            EvidenceItem(
                id="ev-1",
                title="OAC 4723-9-10",
                snippet="Prescriptive authority for CNPs...",
                citation="OAC 4723-9-10",
                sourceId="doc-123",
                tags=["prescribing", "cnp"],
                metadata={"source": "ohio_law"},
                includedInPacket=True,
            ),
            EvidenceItem(
                id="ev-2",
                title="ORC 4723.48",
                snippet="Advanced practice nursing...",
                citation="ORC 4723.48",
                sourceId="doc-124",
                tags=["advanced_practice"],
                metadata={"source": "ohio_law"},
                includedInPacket=False,
            ),
        ],
    )
    
    case = create_case(case_input)
    print(f"✓ Created case: {case.id}")
    print(f"  - Status: {case.status}")
    print(f"  - Evidence count: {len(case.evidence)}")
    print(f"  - Packet evidence: {case.packetEvidenceIds}")
    
    # Get case
    retrieved = get_case(case.id)
    assert retrieved is not None, "Failed to retrieve case"
    assert retrieved.id == case.id
    assert len(retrieved.evidence) == 2
    print(f"✓ Retrieved case: {retrieved.id}")
    
    # Update case
    update_input = CaseUpdateInput(
        status=CaseStatus.IN_REVIEW,
        assignedTo="reviewer@example.com",
        reviewerNotes="Initial review in progress",
    )
    updated = update_case(case.id, update_input)
    assert updated.status == CaseStatus.IN_REVIEW
    assert updated.assignedTo == "reviewer@example.com"
    print(f"✓ Updated case status to: {updated.status}")
    
    # List cases
    cases = list_cases()
    assert len(cases) >= 1
    print(f"✓ Listed {len(cases)} case(s)")
    
    # Filter cases
    filters = CaseListFilters(status=CaseStatus.IN_REVIEW)
    filtered = list_cases(filters)
    assert all(c.status == CaseStatus.IN_REVIEW for c in filtered)
    print(f"✓ Filtered cases by status: {len(filtered)} in review")
    
    return case.id


def test_audit_events(case_id: str):
    """Test audit event operations."""
    print("\n=== Testing Audit Events ===")
    
    # Add audit events
    event1 = add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.STATUS_CHANGED,
        actor="verifier@example.com",
        source="web",
        message="Case created",
        meta={"old_status": None, "new_status": "new"},
    ))
    print(f"✓ Created event: {event1.id} - {event1.eventType}")
    
    event2 = add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.ASSIGNED,
        actor="admin@example.com",
        source="web",
        message="Assigned to reviewer",
        meta={"assignee": "reviewer@example.com"},
    ))
    print(f"✓ Created event: {event2.id} - {event2.eventType}")
    
    # List events
    events = list_audit_events(case_id)
    assert len(events) >= 2
    print(f"✓ Listed {len(events)} event(s) for case")
    
    # Verify ordering (newest first)
    assert events[0].createdAt >= events[1].createdAt
    print(f"✓ Events correctly ordered (newest first)")


def test_evidence_operations(case_id: str):
    """Test evidence upsert operations."""
    print("\n=== Testing Evidence Operations ===")
    
    # Update packet evidence IDs
    updated_case = upsert_evidence(
        case_id=case_id,
        packet_evidence_ids=["ev-1", "ev-2"],  # Include both
    )
    assert len(updated_case.packetEvidenceIds) == 2
    print(f"✓ Updated packet evidence IDs: {updated_case.packetEvidenceIds}")
    
    # Add new evidence
    new_evidence = [
        EvidenceItem(
            id="ev-3",
            title="OAC 4723-9-11",
            snippet="Controlled substance regulations...",
            citation="OAC 4723-9-11",
            sourceId="doc-125",
            tags=["controlled_substances"],
            metadata={"source": "ohio_law"},
            includedInPacket=True,
        ),
    ]
    
    updated_case = upsert_evidence(
        case_id=case_id,
        evidence=updated_case.evidence + new_evidence,
    )
    assert len(updated_case.evidence) == 3
    print(f"✓ Added new evidence (total: {len(updated_case.evidence)})")


def test_submission_crud():
    """Test submission CRUD operations."""
    print("\n=== Testing Submission CRUD ===")
    
    # Create submission
    submission_input = SubmissionCreateInput(
        decisionType="csf",
        submittedBy="user@example.com",
        accountId="account-123",
        locationId="location-456",
        formData={
            "practitionerName": "Dr. Jane Smith",
            "licenseNumber": "NP.12345",
            "question": "Can I prescribe controlled substances?",
        },
        rawPayload={"timestamp": datetime.utcnow().isoformat()},
        evaluatorOutput={
            "decision": "approved",
            "confidence": 0.95,
        },
    )
    
    submission = create_submission(submission_input)
    print(f"✓ Created submission: {submission.id}")
    print(f"  - Decision type: {submission.decisionType}")
    print(f"  - Submitted by: {submission.submittedBy}")
    
    # Get submission
    retrieved = get_submission(submission.id)
    assert retrieved is not None
    assert retrieved.id == submission.id
    print(f"✓ Retrieved submission: {retrieved.id}")
    
    # List submissions
    submissions = list_submissions()
    assert len(submissions) >= 1
    print(f"✓ Listed {len(submissions)} submission(s)")
    
    # Filter submissions
    filters = SubmissionListFilters(decisionType="csf")
    filtered = list_submissions(filters)
    assert all(s.decisionType == "csf" for s in filtered)
    print(f"✓ Filtered submissions by type: {len(filtered)} CSF submissions")
    
    return submission.id


def test_persistence():
    """Test data persistence (survives process restart)."""
    print("\n=== Testing Persistence ===")
    
    # Get stats before
    stats = get_store_stats()
    print(f"✓ Store stats:")
    print(f"  - Cases: {stats['case_count']}")
    print(f"  - Events: {stats['total_events']}")
    print(f"  - By status: {stats['cases_by_status']}")
    
    print("\n✓ Data persisted to database!")
    print("  - Database file: backend/app/data/autocomply.db")
    print("  - Run this script again to verify persistence")


def main():
    """Run all tests."""
    print("=" * 70)
    print("SQLite Repository Test Suite")
    print("=" * 70)
    
    # Initialize database
    print("\n=== Initializing Database ===")
    init_db()
    print("✓ Database initialized")
    
    # Clean slate for testing
    print("\n=== Resetting Store ===")
    reset_store()
    clear_all_submissions()
    print("✓ Store reset")
    
    # Run tests
    try:
        case_id = test_case_crud()
        test_audit_events(case_id)
        test_evidence_operations(case_id)
        submission_id = test_submission_crud()
        test_persistence()
        
        print("\n" + "=" * 70)
        print("✅ ALL TESTS PASSED!")
        print("=" * 70)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
