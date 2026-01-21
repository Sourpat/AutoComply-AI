"""
Test script for adherence endpoint

Quick test to verify /workflow/cases/{case_id}/adherence endpoint works
"""

import pytest
pytest.skip("Legacy manual script; not part of core pytest suite", allow_module_level=True)

import sys
sys.path.insert(0, 'C:\\Users\\soura\\Documents\\Projects\\Projects\\AutoComply-AI-fresh\\backend')

from app.workflow.repo import list_cases, create_case
from app.workflow.adherence import get_case_adherence
from src.core.db import init_db
from datetime import datetime, timedelta, timezone

# Initialize database
init_db()

# Get or create a test case
print("=" * 70)
print("Testing Adherence Endpoint")
print("=" * 70)

# List existing cases
cases_result = list_cases(filters={})
# list_cases returns (items, total)
cases, total = cases_result
print(f"\nFound {total} existing cases")

if not cases:
    # Create a test case
    print("\nNo cases found. Creating a test case...")
    from app.workflow.models import CaseCreateInput
    
    test_case = create_case(CaseCreateInput(
        decisionType="csf_practitioner",
        title="Test CSF Practitioner Application",
        summary="Test case for adherence endpoint",
        dueAt=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat() + "Z"
    ))
    case_id = test_case['id']
    decision_type = test_case['decisionType']
    print(f"✓ Created test case: {case_id}")
else:
    case_id = cases[0].id
    decision_type = cases[0].decisionType
    print(f"\n✓ Using existing case: {case_id}")

print(f"  Decision Type: {decision_type}")
print(f"  Title: {cases[0].title if cases else 'Test CSF Practitioner Application'}")

# Test adherence endpoint
print("\n" + "-" * 70)
print("Testing get_case_adherence()...")
print("-" * 70)

try:
    adherence = get_case_adherence(case_id)
    
    if adherence:
        print("\n✓ SUCCESS: Adherence data retrieved")
        print(f"  Decision Type: {adherence.get('decisionType')}")
        print(f"  Adherence %: {adherence.get('adherencePct')}%")
        print(f"  Total Steps: {adherence.get('totalSteps')}")
        print(f"  Completed Steps: {len(adherence.get('completedSteps', []))}")
        print(f"  Missing Steps: {len(adherence.get('missingSteps', []))}")
        print(f"  Recommendations: {len(adherence.get('recommendedNextActions', []))}")
        
        if adherence.get('message'):
            print(f"  Message: {adherence.get('message')}")
        
        print("\n✓ Test PASSED - Adherence endpoint is working!")
    else:
        print("\n✗ ERROR: get_case_adherence() returned None")
        print("  This means the case was not found in the database")
        
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    print(f"  Exception type: {type(e).__name__}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
print("Test Complete")
print("=" * 70)
