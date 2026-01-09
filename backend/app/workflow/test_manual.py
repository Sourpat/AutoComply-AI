"""
Workflow Console - Manual Test Script

Step 2.9: Backend Persistence Layer Testing

Simple test script that can run without pytest.
Run with: python backend/app/workflow/test_manual.py
"""

import sys
from datetime import datetime, timedelta

from app.workflow.models import (
    CaseStatus,
    AuditEventType,
    EvidenceItem,
    CaseCreateInput,
    CaseUpdateInput,
    CaseListFilters,
    AuditEventCreateInput,
)
from app.workflow.repo import (
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


def test_case_creation():
    """Test creating cases."""
    print("🧪 Testing case creation...")
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Sarah Smith - CSF Application",
        summary="Application for controlled substance facilitation",
        submissionId="sub-12345"
    ))
    
    assert case.id is not None, "Case ID should be generated"
    assert case.status == CaseStatus.NEW, "Initial status should be NEW"
    assert case.submissionId == "sub-12345", "Submission ID should match"
    print(f"✅ Created case: {case.id} - {case.title}")
    return case.id


def test_case_with_evidence():
    """Test creating case with evidence."""
    print("\n🧪 Testing case with evidence...")
    
    evidence = [
        EvidenceItem(
            id="ev-1",
            title="OAC 4723-9-10 - CSF Practitioner Requirements",
            snippet="All practitioners must complete required training...",
            citation="OAC 4723-9-10",
            sourceId="doc-ohio-csf-001",
            tags=["Ohio", "CSF", "Training"],
            includedInPacket=True
        ),
        EvidenceItem(
            id="ev-2",
            title="Federal DEA Requirements",
            snippet="Federal DEA registration required for...",
            citation="21 CFR 1301",
            sourceId="doc-federal-dea-001",
            tags=["Federal", "DEA"],
            includedInPacket=True
        ),
        EvidenceItem(
            id="ev-3",
            title="Background Check Requirements",
            snippet="Background checks must be completed...",
            citation="ORC 4723.24",
            sourceId="doc-ohio-bg-001",
            tags=["Ohio", "Background"],
            includedInPacket=False
        )
    ]
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Bob Jones - CSF Application",
        evidence=evidence
    ))
    
    assert len(case.evidence) == 3, "Should have 3 evidence items"
    assert len(case.packetEvidenceIds) == 2, "Should have 2 items in packet"
    print(f"✅ Created case with {len(case.evidence)} evidence items")
    print(f"   Packet includes: {len(case.packetEvidenceIds)} items")
    return case.id


def test_case_updates():
    """Test updating cases."""
    print("\n🧪 Testing case updates...")
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    # Update status
    updated = update_case(case.id, CaseUpdateInput(
        status=CaseStatus.IN_REVIEW,
        assignedTo="verifier@example.com"
    ))
    
    assert updated.status == CaseStatus.IN_REVIEW, "Status should be updated"
    assert updated.assignedTo == "verifier@example.com", "Assignee should be set"
    print(f"✅ Updated case status: {updated.status}")
    print(f"   Assigned to: {updated.assignedTo}")
    return case.id


def test_case_listing():
    """Test listing and filtering cases."""
    print("\n🧪 Testing case listing and filtering...")
    
    # Reset to have a clean slate
    reset_store()
    
    # Create multiple cases
    case1 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Alice - CSF",
        assignedTo="verifier1@example.com"
    ))
    
    case2 = create_case(CaseCreateInput(
        decisionType="ohio_tddd",
        title="Hospital XYZ - TDDD License"
    ))
    
    case3 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Dr. Charlie - CSF",
        assignedTo="verifier2@example.com"
    ))
    
    # Update one to different status
    update_case(case1.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    
    # List all cases
    all_cases = list_cases()
    assert len(all_cases) == 3, "Should have 3 cases total"
    print(f"✅ Listed all cases: {len(all_cases)} total")
    
    # Filter by status
    new_cases = list_cases(CaseListFilters(status=CaseStatus.NEW))
    assert len(new_cases) == 2, "Should have 2 NEW cases"
    print(f"   NEW cases: {len(new_cases)}")
    
    # Filter by decision type
    csf_cases = list_cases(CaseListFilters(decisionType="csf_practitioner"))
    assert len(csf_cases) == 2, "Should have 2 CSF cases"
    print(f"   CSF practitioner cases: {len(csf_cases)}")
    
    # Filter by assignee
    assigned_cases = list_cases(CaseListFilters(assignedTo="verifier1@example.com"))
    assert len(assigned_cases) == 1, "Should have 1 assigned case"
    print(f"   Cases assigned to verifier1: {len(assigned_cases)}")
    
    # Filter unassigned
    unassigned = list_cases(CaseListFilters(unassigned=True))
    assert len(unassigned) == 1, "Should have 1 unassigned case"
    print(f"   Unassigned cases: {len(unassigned)}")
    
    # Search
    alice_cases = list_cases(CaseListFilters(search="Alice"))
    assert len(alice_cases) == 1, "Should find 1 case with 'Alice'"
    print(f"   Search 'Alice': {len(alice_cases)} results")


def test_audit_events():
    """Test audit event tracking."""
    print("\n🧪 Testing audit events...")
    
    reset_store()
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    # Add creation event
    event1 = add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.CASE_CREATED,
        actor="system",
        message="Case created from submission",
        meta={"submissionId": "sub-123"}
    ))
    
    # Add status change event
    event2 = add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.STATUS_CHANGED,
        actor="verifier@example.com",
        message="Status changed to IN_REVIEW",
        meta={"old_status": "new", "new_status": "in_review"}
    ))
    
    # Add evidence event
    event3 = add_audit_event(AuditEventCreateInput(
        caseId=case.id,
        eventType=AuditEventType.EVIDENCE_ATTACHED,
        actor="system",
        message="Attached 3 RAG evidence documents",
        meta={"evidenceCount": 3}
    ))
    
    # List events
    events = list_audit_events(case.id)
    
    assert len(events) == 3, "Should have 3 audit events"
    # Check all event types are present
    event_types = {e.eventType for e in events}
    assert AuditEventType.CASE_CREATED in event_types, "Should have CASE_CREATED event"
    assert AuditEventType.STATUS_CHANGED in event_types, "Should have STATUS_CHANGED event"
    assert AuditEventType.EVIDENCE_ATTACHED in event_types, "Should have EVIDENCE_ATTACHED event"
    print(f"✅ Created {len(events)} audit events")
    print(f"   Latest event: {events[0].eventType}")
    
    # Print timeline
    print("\n   Timeline:")
    for event in reversed(events):  # Show oldest first
        print(f"   • {event.eventType}: {event.message}")


def test_evidence_management():
    """Test evidence curation."""
    print("\n🧪 Testing evidence management...")
    
    reset_store()
    
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case"
    ))
    
    # Add evidence
    evidence = [
        EvidenceItem(
            id="ev-1",
            title="Document 1",
            snippet="Content 1",
            citation="Citation 1",
            sourceId="doc-1",
            includedInPacket=True
        ),
        EvidenceItem(
            id="ev-2",
            title="Document 2",
            snippet="Content 2",
            citation="Citation 2",
            sourceId="doc-2",
            includedInPacket=True
        ),
        EvidenceItem(
            id="ev-3",
            title="Document 3",
            snippet="Content 3",
            citation="Citation 3",
            sourceId="doc-3",
            includedInPacket=True
        )
    ]
    
    updated = upsert_evidence(case.id, evidence=evidence)
    assert len(updated.evidence) == 3, "Should have 3 evidence items"
    assert len(updated.packetEvidenceIds) == 3, "All included initially"
    print(f"✅ Added {len(updated.evidence)} evidence items")
    
    # Update packet selection (exclude ev-2)
    updated = upsert_evidence(case.id, packet_evidence_ids=["ev-1", "ev-3"])
    assert len(updated.evidence) == 3, "Evidence list unchanged"
    assert len(updated.packetEvidenceIds) == 2, "Only 2 in packet now"
    assert "ev-2" not in updated.packetEvidenceIds, "ev-2 excluded"
    print(f"   Updated packet: {len(updated.packetEvidenceIds)} items included")


def test_overdue_cases():
    """Test overdue case filtering."""
    print("\n🧪 Testing overdue case filtering...")
    
    reset_store()
    
    # Create overdue case (due 1 hour ago)
    past_due = datetime.utcnow() - timedelta(hours=1)
    case1 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Overdue Case",
        dueAt=past_due
    ))
    
    # Create not-overdue case (due in 24 hours)
    future_due = datetime.utcnow() + timedelta(hours=24)
    case2 = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="On-Time Case",
        dueAt=future_due
    ))
    
    # Filter overdue
    overdue = list_cases(CaseListFilters(overdue=True))
    assert len(overdue) == 1, "Should have 1 overdue case"
    assert overdue[0].id == case1.id, "Should be the past-due case"
    print(f"✅ Found {len(overdue)} overdue case")


def test_store_stats():
    """Test store statistics."""
    print("\n🧪 Testing store statistics...")
    
    reset_store()
    
    # Create cases with different statuses
    case1 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 1"))
    case2 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 2"))
    case3 = create_case(CaseCreateInput(decisionType="csf_practitioner", title="Case 3"))
    
    update_case(case1.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    update_case(case2.id, CaseUpdateInput(status=CaseStatus.APPROVED))
    
    # Add some events
    add_audit_event(AuditEventCreateInput(
        caseId=case1.id,
        eventType=AuditEventType.CASE_CREATED
    ))
    add_audit_event(AuditEventCreateInput(
        caseId=case1.id,
        eventType=AuditEventType.STATUS_CHANGED
    ))
    
    stats = get_store_stats()
    
    assert stats["case_count"] == 3, "Should have 3 cases"
    assert stats["total_events"] == 2, "Should have 2 events"
    assert stats["cases_by_status"]["new"] == 1, "1 NEW case"
    assert stats["cases_by_status"]["in_review"] == 1, "1 IN_REVIEW case"
    assert stats["cases_by_status"]["approved"] == 1, "1 APPROVED case"
    
    print("✅ Store statistics:")
    print(f"   Total cases: {stats['case_count']}")
    print(f"   Total events: {stats['total_events']}")
    print(f"   Cases by status:")
    for status, count in stats["cases_by_status"].items():
        if count > 0:
            print(f"     • {status}: {count}")


def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("WORKFLOW REPOSITORY TESTS")
    print("=" * 60)
    
    try:
        # Reset before starting
        reset_store()
        
        test_case_creation()
        test_case_with_evidence()
        test_case_updates()
        test_case_listing()
        test_audit_events()
        test_evidence_management()
        test_overdue_cases()
        test_store_stats()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print("\nStep 2.9: Backend Persistence Layer ✓ COMPLETE")
        print("\nReady for:")
        print("- API endpoint integration")
        print("- Frontend-backend connection")
        print("- Database migration (future)")
        
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
