"""Quick test to debug status comparison logic."""
from app.workflow.models import CaseUpdateInput, CaseStatus

# Simulate what FastAPI does when parsing JSON {"status": "in_review"}
updates = CaseUpdateInput(status="in_review", assignedTo="test@example.com")

print(f"updates.status = {updates.status}")
print(f"type(updates.status) = {type(updates.status)}")
print(f"updates.status value = {updates.status.value if updates.status else 'None'}")
print()

# Simulate current case
current_status = CaseStatus.NEW
print(f"current_status = {current_status}")
print(f"type(current_status) = {type(current_status)}")
print(f"current_status.value = {current_status.value}")
print()

# Test the condition
print(f"updates.status is truthy: {bool(updates.status)}")
print(f"updates.status != current_status: {updates.status != current_status}")
print(f"Full condition result: {bool(updates.status and updates.status != current_status)}")
