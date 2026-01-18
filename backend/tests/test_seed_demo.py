"""
Tests for Demo Data Seeding

Verifies:
1. Seed function creates cases when DB is empty
2. Seed function is idempotent (no duplicates on second run)
3. /dev/seed endpoint requires proper authorization
4. /dev/seed endpoint returns correct case count
"""

import pytest
from fastapi.testclient import TestClient

from app.dev.seed_demo import seed_demo_data, is_empty_workflow_db
from app.workflow.repo import list_cases, get_case
from src.core.db import execute_sql
from src.api.main import app

client = TestClient(app)


def test_seed_creates_cases_when_empty():
    """Test that seed_demo_data creates cases when DB is empty."""
    # Verify DB is empty
    assert is_empty_workflow_db(), "Expected empty workflow DB for test"
    
    # Run seed
    cases_created = seed_demo_data()
    
    # Verify cases were created
    assert cases_created > 0, "Expected at least 1 case to be created"
    assert cases_created == 5, f"Expected 5 demo cases, got {cases_created}"
    
    # Verify cases exist in DB
    cases, total = list_cases(limit=100, offset=0)
    assert total == 5, f"Expected 5 total cases in DB, got {total}"
    assert len(cases) == 5, f"Expected 5 cases returned, got {len(cases)}"
    
    # Verify decision types
    decision_types = {c.decisionType for c in cases}
    expected_types = {"csf_practitioner", "csf_facility", "ohio_tddd", "license", "csa"}
    assert decision_types == expected_types, f"Expected {expected_types}, got {decision_types}"


def test_seed_is_idempotent():
    """Test that running seed twice doesn't create duplicates."""
    # First seed
    first_count = seed_demo_data()
    assert first_count > 0, "Expected cases to be created on first seed"
    
    # Get initial count
    _, initial_total = list_cases(limit=100, offset=0)
    
    # Second seed (should do nothing)
    second_count = seed_demo_data()
    assert second_count == 0, "Expected 0 cases on second seed (already seeded)"
    
    # Verify count unchanged
    _, final_total = list_cases(limit=100, offset=0)
    assert final_total == initial_total, f"Expected {initial_total} cases, got {final_total}"


def test_seed_creates_evidence_items():
    """Test that seeded cases include evidence items."""
    # Run seed
    cases_created = seed_demo_data()
    assert cases_created > 0, "Expected cases to be created"
    
    # Get first case (list_cases returns summary, use get_case for full details)
    cases, _ = list_cases(limit=1, offset=0)
    assert len(cases) > 0, "Expected at least 1 case"
    
    # Load full case with evidence
    case = get_case(cases[0].id)
    assert case is not None, "Expected to retrieve case by ID"
    
    # Verify evidence exists
    assert len(case.evidence) > 0, "Expected case to have evidence items"
    
    # Verify evidence structure
    first_evidence = case.evidence[0]
    assert first_evidence.id is not None, "Expected evidence to have ID"
    assert first_evidence.title is not None, "Expected evidence to have title"
    assert first_evidence.snippet is not None, "Expected evidence to have snippet"
    assert first_evidence.citation is not None, "Expected evidence to have citation"
    assert len(first_evidence.tags) > 0, "Expected evidence to have tags"


def test_seed_endpoint_requires_auth():
    """Test that /dev/seed endpoint requires authorization."""
    # Attempt without auth
    response = client.post("/dev/seed")
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    assert "Forbidden" in response.json()["detail"]


def test_seed_endpoint_with_admin_unlocked():
    """Test /dev/seed endpoint with admin_unlocked=1."""
    # Call with admin_unlocked
    response = client.post("/dev/seed?admin_unlocked=1")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert data["ok"] is True, "Expected ok=true"
    assert data["cases_created"] >= 0, "Expected non-negative cases_created"
    assert "message" in data, "Expected message field"


def test_seed_endpoint_with_devsupport_role():
    """Test /dev/seed endpoint with x-user-role=devsupport."""
    # Call with devsupport role (using query param alias)
    response = client.post("/dev/seed?x-user-role=devsupport")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert data["ok"] is True, "Expected ok=true"


def test_seed_endpoint_idempotency():
    """Test that /dev/seed endpoint is idempotent."""
    # First call
    response1 = client.post("/dev/seed?admin_unlocked=1")
    assert response1.status_code == 200
    data1 = response1.json()
    cases_created_first = data1["cases_created"]
    
    # Second call (should return 0 new cases)
    response2 = client.post("/dev/seed?admin_unlocked=1")
    assert response2.status_code == 200
    data2 = response2.json()
    cases_created_second = data2["cases_created"]
    
    assert cases_created_second == 0, f"Expected 0 cases on second call, got {cases_created_second}"
    assert "already exists" in data2["message"].lower(), "Expected 'already exists' message"


def test_seeded_cases_have_realistic_data():
    """Test that seeded cases have realistic titles, summaries, and assignments."""
    # Seed data
    cases_created = seed_demo_data()
    assert cases_created > 0
    
    # Get all cases
    cases, _ = list_cases(limit=100, offset=0)
    
    # Verify all cases have required fields
    for case in cases:
        assert case.title is not None and len(case.title) > 0, f"Case {case.id} missing title"
        assert case.summary is not None and len(case.summary) > 0, f"Case {case.id} missing summary"
        assert case.decisionType is not None, f"Case {case.id} missing decisionType"
        assert case.dueAt is not None, f"Case {case.id} missing dueAt"
        # Note: assignedTo can be None (unassigned cases)
    
    # Verify at least one case is assigned
    assigned_cases = [c for c in cases if c.assignedTo is not None]
    assert len(assigned_cases) > 0, "Expected at least one assigned case"
    
    # Verify assigned cases have valid email-like assignedTo
    for case in assigned_cases:
        assert "@" in case.assignedTo, f"Expected email-like assignedTo, got {case.assignedTo}"
