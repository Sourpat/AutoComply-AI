"""
Phase 1 Integration Test

Verifies submission-to-case workflow works end-to-end.
"""

import sys
import json
sys.path.insert(0, 'C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend')

from app.submissions.repo import create_submission, get_submission
from app.submissions.models import SubmissionCreateInput
from app.workflow.repo import list_cases, get_case
from src.core.db import init_db

print("=" * 80)
print("Phase 1: Real Case Integration Test")
print("=" * 80)

# Initialize database
init_db()
print("\n✓ Database initialized")

# Test 1: Create submission
print("\n" + "-" * 80)
print("TEST 1: Create Submission")
print("-" * 80)

submission_input = SubmissionCreateInput(
    decisionType="csf_practitioner",
    submittedBy="test@example.com",
    formData={
        "name": "Dr. Test User",
        "licenseNumber": "TEST-123",
        "specialty": "Internal Medicine",
        "state": "CA"
    }
)

# Manually create case (simulating what router does)
from datetime import datetime, timedelta, timezone
from app.workflow.models import CaseCreateInput
from app.workflow.repo import create_case

submission = create_submission(submission_input)
print(f"✓ Created submission: {submission.id}")
print(f"  Decision Type: {submission.decisionType}")
print(f"  Submitted By: {submission.submittedBy}")
print(f"  Form Data: {json.dumps(submission.formData, indent=2)}")

# Create linked case
submitter_name = submission.formData.get('name', 'Unknown')
due_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat() + 'Z'

case_input = CaseCreateInput(
    decisionType=submission.decisionType,
    submissionId=submission.id,
    title=f"Practitioner CSF – {submitter_name}",
    summary=f"New submission from {submitter_name}",
    status='new',
    dueAt=due_at,
)

case = create_case(case_input)
print(f"\n✓ Created linked case: {case.id}")
print(f"  Title: {case.title}")
print(f"  Status: {case.status}")
print(f"  Submission ID: {case.submissionId}")
print(f"  Due: {case.dueAt}")

# Test 2: Verify case appears in list
print("\n" + "-" * 80)
print("TEST 2: List Cases")
print("-" * 80)

cases_result = list_cases(filters={})
cases, total = cases_result
print(f"✓ Total cases in database: {total}")

# Find our case
our_case = None
for c in cases:
    if c.id == case.id:
        our_case = c
        break

if our_case:
    print(f"✓ Found our case in list: {our_case.title}")
else:
    print("✗ ERROR: Case not found in list!")
    sys.exit(1)

# Test 3: Get case by ID
print("\n" + "-" * 80)
print("TEST 3: Get Case by ID")
print("-" * 80)

retrieved_case = get_case(case.id)
if retrieved_case:
    print(f"✓ Retrieved case: {retrieved_case.id}")
    print(f"  Title: {retrieved_case.title}")
    print(f"  Submission ID: {retrieved_case.submissionId}")
else:
    print("✗ ERROR: Could not retrieve case!")
    sys.exit(1)

# Test 4: Get linked submission
print("\n" + "-" * 80)
print("TEST 4: Get Linked Submission")
print("-" * 80)

if retrieved_case.submissionId:
    linked_submission = get_submission(retrieved_case.submissionId)
    if linked_submission:
        print(f"✓ Retrieved linked submission: {linked_submission.id}")
        print(f"  Matches original: {linked_submission.id == submission.id}")
        print(f"  Form Data Name: {linked_submission.formData.get('name')}")
    else:
        print("✗ ERROR: Could not retrieve linked submission!")
        sys.exit(1)
else:
    print("✗ ERROR: Case has no submission_id!")
    sys.exit(1)

# Test 5: Verify linkage
print("\n" + "-" * 80)
print("TEST 5: Verify Linkage")
print("-" * 80)

if submission.id == linked_submission.id == retrieved_case.submissionId:
    print("✓ PASS: Submission ↔ Case linkage verified")
    print(f"  Submission ID: {submission.id}")
    print(f"  Case submission_id: {retrieved_case.submissionId}")
    print(f"  Retrieved submission ID: {linked_submission.id}")
else:
    print("✗ FAIL: Linkage mismatch!")
    sys.exit(1)

# Summary
print("\n" + "=" * 80)
print("All Tests Passed! ✓")
print("=" * 80)
print("\nPhase 1 Integration Status: VERIFIED")
print("- Submission creation: ✓")
print("- Case creation: ✓")
print("- Case listing: ✓")
print("- Case retrieval: ✓")
print("- Submission linkage: ✓")
print("\nNext Step: Test via HTTP API")
print("  1. Start backend: cd backend && .venv\\Scripts\\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001")
print("  2. POST http://localhost:8001/submissions")
print("  3. GET http://localhost:8001/workflow/cases")
print("  4. GET http://localhost:8001/workflow/cases/{id}/submission")
