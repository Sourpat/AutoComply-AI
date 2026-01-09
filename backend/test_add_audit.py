"""Direct test of add_audit_event function."""
import sys
sys.path.insert(0, "C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend")

from app.workflow.repo import add_audit_event, list_audit_events
from app.workflow.models import AuditEventCreateInput, AuditEventType

# Use the case we just created
case_id = "1d2b7caf-ca9b-4bd5-8b3d-03428ecc353c"

print(f"Before adding event:")
events = list_audit_events(case_id)
print(f"  Events count: {len(events)}")

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
events = list_audit_events(case_id)
print(f"  Events count: {len(events)}")
for event in events:
    print(f"    - {event.eventType.value}: {event.message}")
