"""
Phase 2 Backend Tests (Legacy)

Legacy tests for case lifecycle management: status transitions, notes, decisions, timeline.
These rely on older store behaviors and are excluded from the core suite.
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime

pytestmark = pytest.mark.skip(reason="Legacy Phase 2 backend tests (store-based expectations). Run explicitly via pytest backend/tests/legacy -q")

# Add backend to Python path
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from app.workflow.models import (
    CaseCreateInput,
    CaseUpdateInput,
    CaseStatus,
    CaseNoteCreateInput,
    CaseDecisionCreateInput,
)
from app.workflow.repo import (
    create_case,
    get_case,
    update_case,
    validate_status_transition,
    create_case_note,
    list_case_notes,
    get_case_timeline,
    create_case_decision,
    get_case_decision_by_case,
    reset_store,
)


@pytest.fixture(autouse=True)
def clean_store():
    """Clean store before each test."""
    reset_store()
    yield
    reset_store()


def test_validate_status_transitions():
    """Test status transition validation."""
    
    # Valid transitions
    assert validate_status_transition(CaseStatus.NEW, CaseStatus.IN_REVIEW) == True
    assert validate_status_transition(CaseStatus.IN_REVIEW, CaseStatus.NEEDS_INFO) == True
    assert validate_status_transition(CaseStatus.IN_REVIEW, CaseStatus.APPROVED) == True
    assert validate_status_transition(CaseStatus.NEEDS_INFO, CaseStatus.IN_REVIEW) == True
    assert validate_status_transition(CaseStatus.APPROVED, CaseStatus.CLOSED) == True
    
    # Invalid transitions
    assert validate_status_transition(CaseStatus.CLOSED, CaseStatus.NEW) == False
    assert validate_status_transition(CaseStatus.NEW, CaseStatus.APPROVED) == False
    assert validate_status_transition(CaseStatus.NEEDS_INFO, CaseStatus.APPROVED) == False
    
    # Same status is always valid
    assert validate_status_transition(CaseStatus.NEW, CaseStatus.NEW) == True
    assert validate_status_transition(CaseStatus.CLOSED, CaseStatus.CLOSED) == True


def test_create_case_note():
    """Test creating case notes."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Notes",
    ))
    
    # Create a note
    note_input = CaseNoteCreateInput(
        noteText="This is a test note",
        authorRole="reviewer",
        authorName="Test Reviewer",
    )
    
    note = create_case_note(case.id, note_input)
    
    assert note.id is not None
    assert note.caseId == case.id
    assert note.noteText == "This is a test note"
    assert note.authorRole == "reviewer"
    assert note.authorName == "Test Reviewer"
    assert isinstance(note.createdAt, datetime)


def test_list_case_notes():
    """Test listing case notes."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Note List",
    ))
    
    # Create multiple notes
    note1 = create_case_note(case.id, CaseNoteCreateInput(
        noteText="First note",
        authorRole="reviewer",
    ))
    
    note2 = create_case_note(case.id, CaseNoteCreateInput(
        noteText="Second note",
        authorRole="admin",
    ))
    
    # List notes
    notes = list_case_notes(case.id)
    
    assert len(notes) == 2
    # Should be ordered by creation time descending (newest first)
    assert notes[0].id == note2.id
    assert notes[1].id == note1.id


def test_case_timeline():
    """Test combined timeline of notes and events."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Timeline",
    ))
    
    # Add a note
    create_case_note(case.id, CaseNoteCreateInput(
        noteText="Test note",
        authorRole="reviewer",
    ))
    
    # Update status (creates event)
    update_case(case.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    
    # Get timeline
    timeline = get_case_timeline(case.id)
    
    # Should have note + note_added event + status_changed event
    assert len(timeline) >= 2
    
    # Check item types
    item_types = [item.itemType for item in timeline]
    assert "note" in item_types
    assert "event" in item_types


def test_create_case_decision_approved():
    """Test creating an approval decision."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Approval",
    ))
    
    # Make approval decision
    decision_input = CaseDecisionCreateInput(
        decision="APPROVED",
        reason="Meets all requirements",
        decidedByRole="reviewer",
        decidedByName="Test Reviewer",
    )
    
    decision = create_case_decision(case.id, decision_input)
    
    assert decision.id is not None
    assert decision.caseId == case.id
    assert decision.decision == "APPROVED"
    assert decision.reason == "Meets all requirements"
    
    # Verify case status was updated to APPROVED
    updated_case = get_case(case.id)
    assert updated_case.status == CaseStatus.APPROVED


def test_create_case_decision_rejected():
    """Test creating a rejection decision."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Rejection",
    ))
    
    # Make rejection decision
    decision_input = CaseDecisionCreateInput(
        decision="REJECTED",
        reason="Missing required documentation",
        details={"missing_docs": ["license", "certification"]},
        decidedByRole="reviewer",
        decidedByName="Test Reviewer",
    )
    
    decision = create_case_decision(case.id, decision_input)
    
    assert decision.id is not None
    assert decision.decision == "REJECTED"
    assert decision.reason == "Missing required documentation"
    assert decision.details["missing_docs"] == ["license", "certification"]
    
    # Verify case status was updated to BLOCKED
    updated_case = get_case(case.id)
    assert updated_case.status == CaseStatus.BLOCKED


def test_get_case_decision_by_case():
    """Test retrieving the most recent decision for a case."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Decision Retrieval",
    ))
    
    # Make a decision
    create_case_decision(case.id, CaseDecisionCreateInput(
        decision="APPROVED",
        reason="Initial approval",
    ))
    
    # Retrieve decision
    decision = get_case_decision_by_case(case.id)
    
    assert decision is not None
    assert decision.caseId == case.id
    assert decision.decision == "APPROVED"


def test_status_transition_with_event():
    """Test that status updates create events when using create_case_event."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Status Events",
    ))
    
    initial_status = case.status
    
    # Update status
    from app.workflow.repo import create_case_event
    update_case(case.id, CaseUpdateInput(status=CaseStatus.IN_REVIEW))
    
    # Manually create status change event (in real usage, router does this)
    create_case_event(
        case_id=case.id,
        event_type="status_changed",
        event_payload={
            "old_status": initial_status.value,
            "new_status": CaseStatus.IN_REVIEW.value,
        },
        actor_role="reviewer",
        actor_name="Test User",
    )
    
    # Get timeline to verify event was created
    timeline = get_case_timeline(case.id)
    
    # Find status_changed event
    status_events = [item for item in timeline if item.itemType == "event" and "Status changed" in item.content]
    
    assert len(status_events) > 0
    # Verify event mentions old and new status
    event = status_events[0]
    assert initial_status.value in event.content.lower()
    assert "in_review" in event.content.lower()


def test_note_creates_event():
    """Test that creating a note also creates an event."""
    
    # Create a case
    case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test Case for Note Events",
    ))
    
    # Create a note
    create_case_note(case.id, CaseNoteCreateInput(
        noteText="Test note",
        authorRole="reviewer",
    ))
    
    # Get timeline
    timeline = get_case_timeline(case.id)
    
    # Should have note + note_added event
    assert len(timeline) >= 2
    
    # Verify we have both a note and an event
    has_note = any(item.itemType == "note" for item in timeline)
    has_event = any(item.itemType == "event" for item in timeline)
    
    assert has_note
    assert has_event


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("Phase 2 Backend Tests")
    print("=" * 60 + "\n")
    
    pytest.main([__file__, "-v", "--tb=short"])
