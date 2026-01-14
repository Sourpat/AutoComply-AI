"""Direct test of add_audit_event function."""
import sys
sys.path.insert(0, "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend")

from app.workflow.repo import add_audit_event, list_audit_events
from app.workflow.models import AuditEventCreateInput, AuditEventType


def test_add_audit_event():
    """Test adding an audit event to an existing case."""
    # Use the case we just created
    case_id = "1d2b7caf-ca9b-4bd5-8b3d-03428ecc353c"

    print(f"Before adding event:")
    events, total = list_audit_events(case_id)  # Returns (events_list, total_count) tuple
    print(f"  Events count: {len(events)} (total: {total})")

    # Manually add a status_changed event
    print(f"\nAdding status_changed event...")
    result = add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.STATUS_CHANGED,
        actor="manual_test",
        source="test_script",
        message="Manual test of status change",
        meta={"old": "new", "new": "in_review"}
    ))

    print(f"  Result: {result}")
    print(f"  Event ID: {result.id if result else 'None'}")

    print(f"\nAfter adding event:")
    events, total = list_audit_events(case_id)  # Returns (events_list, total_count) tuple
    print(f"  Events count: {len(events)} (total: {total})")
    for event in events:
        print(f"    - {event.eventType.value}: {event.message}")
    
    # Assert that event was added
    assert result is not None
    assert result.eventType == AuditEventType.STATUS_CHANGED
    assert result.message == "Manual test of status change"
