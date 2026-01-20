"""
Phase 7.29: SLA + Escalation Signals - Tests

Tests SLA classification boundaries, age computation, and endpoint filtering.
"""

import pytest
from datetime import datetime, timedelta
from app.workflow.sla import (
    compute_age_hours,
    compute_sla_status,
    add_sla_fields,
    SLA_IN_REVIEW_WARNING_HOURS,
    SLA_IN_REVIEW_BREACH_HOURS,
)


# ============================================================================
# Unit Tests: compute_age_hours
# ============================================================================


def test_age_hours_from_created_at():
    """Test age calculation from created_at."""
    # Create a case 25 hours ago
    created_at = datetime.utcnow() - timedelta(hours=25)
    age = compute_age_hours(created_at)
    
    # Should be ~25 hours (allow 1 minute tolerance for test execution time)
    assert 24.9 <= age <= 25.1, f"Expected ~25 hours, got {age}"


def test_age_hours_from_status_updated_at():
    """Test age calculation prefers status_updated_at over created_at."""
    # Created 100 hours ago, but status updated 10 hours ago
    created_at = datetime.utcnow() - timedelta(hours=100)
    status_updated_at = datetime.utcnow() - timedelta(hours=10)
    
    age = compute_age_hours(created_at, status_updated_at)
    
    # Should be ~10 hours (from status_updated_at, not created_at)
    assert 9.9 <= age <= 10.1, f"Expected ~10 hours, got {age}"


def test_age_hours_recent_case():
    """Test age calculation for a very recent case."""
    # Created 30 minutes ago
    created_at = datetime.utcnow() - timedelta(minutes=30)
    age = compute_age_hours(created_at)
    
    # Should be ~0.5 hours
    assert 0.4 <= age <= 0.6, f"Expected ~0.5 hours, got {age}"


# ============================================================================
# Unit Tests: compute_sla_status
# ============================================================================


def test_sla_status_ok_under_warning():
    """Test SLA status is 'ok' when under warning threshold."""
    # In review for 12 hours (under 24h warning threshold)
    status = compute_sla_status("in_review", 12.0)
    assert status == "ok", f"Expected 'ok', got '{status}'"


def test_sla_status_warning_at_boundary():
    """Test SLA status is 'warning' exactly at warning threshold."""
    # Exactly at warning threshold (24h)
    status = compute_sla_status("in_review", float(SLA_IN_REVIEW_WARNING_HOURS))
    assert status == "warning", f"Expected 'warning', got '{status}'"


def test_sla_status_warning_above_threshold():
    """Test SLA status is 'warning' when above warning but under breach."""
    # In review for 48 hours (24h < age < 72h)
    status = compute_sla_status("in_review", 48.0)
    assert status == "warning", f"Expected 'warning', got '{status}'"


def test_sla_status_breach_at_boundary():
    """Test SLA status is 'breach' exactly at breach threshold."""
    # Exactly at breach threshold (72h)
    status = compute_sla_status("in_review", float(SLA_IN_REVIEW_BREACH_HOURS))
    assert status == "breach", f"Expected 'breach', got '{status}'"


def test_sla_status_breach_above_threshold():
    """Test SLA status is 'breach' when well above breach threshold."""
    # In review for 120 hours (5 days)
    status = compute_sla_status("in_review", 120.0)
    assert status == "breach", f"Expected 'breach', got '{status}'"


def test_sla_status_new_cases_tracked():
    """Test SLA tracking applies to 'new' status."""
    # New case aged 30 hours (should show warning)
    status = compute_sla_status("new", 30.0)
    assert status == "warning", f"Expected 'warning' for new case, got '{status}'"


def test_sla_status_approved_no_tracking():
    """Test SLA does not apply to approved cases."""
    # Approved case aged 200 hours (should still be 'ok')
    status = compute_sla_status("approved", 200.0)
    assert status == "ok", f"Expected 'ok' for approved case, got '{status}'"


def test_sla_status_blocked_no_tracking():
    """Test SLA does not apply to blocked cases."""
    # Blocked case aged 100 hours (should still be 'ok')
    status = compute_sla_status("blocked", 100.0)
    assert status == "ok", f"Expected 'ok' for blocked case, got '{status}'"


def test_sla_status_needs_info_no_tracking():
    """Test SLA does not apply to needs_info status."""
    # Needs info case aged 80 hours (should be 'ok', not tracked)
    status = compute_sla_status("needs_info", 80.0)
    assert status == "ok", f"Expected 'ok' for needs_info case, got '{status}'"


# ============================================================================
# Unit Tests: add_sla_fields
# ============================================================================


def test_add_sla_fields_basic():
    """Test adding SLA fields to a case dict."""
    now = datetime.utcnow()
    created_at = now - timedelta(hours=36)
    
    case = {
        "id": "case-123",
        "status": "in_review",
        "createdAt": created_at,
        "updatedAt": created_at,
        "title": "Test Case",
    }
    
    enriched = add_sla_fields(case)
    
    # Should have age_hours and sla_status
    assert "age_hours" in enriched
    assert "sla_status" in enriched
    
    # Age should be ~36 hours
    assert 35.9 <= enriched["age_hours"] <= 36.1
    
    # SLA status should be 'warning' (24h < 36h < 72h)
    assert enriched["sla_status"] == "warning"
    
    # Original fields should be preserved
    assert enriched["id"] == "case-123"
    assert enriched["status"] == "in_review"


def test_add_sla_fields_with_iso_strings():
    """Test SLA fields work with ISO timestamp strings."""
    now = datetime.utcnow()
    created_at = now - timedelta(hours=80)
    
    case = {
        "id": "case-456",
        "status": "in_review",
        "createdAt": created_at.isoformat() + "Z",  # ISO string
        "updatedAt": created_at.isoformat() + "Z",
        "title": "Test Case 2",
    }
    
    enriched = add_sla_fields(case)
    
    # Should have age_hours and sla_status
    assert "age_hours" in enriched
    assert "sla_status" in enriched
    
    # Age should be ~80 hours
    assert 79.9 <= enriched["age_hours"] <= 80.1
    
    # SLA status should be 'breach' (>72h)
    assert enriched["sla_status"] == "breach"


def test_add_sla_fields_recent_case():
    """Test SLA fields for a recently created case."""
    now = datetime.utcnow()
    created_at = now - timedelta(minutes=30)
    
    case = {
        "id": "case-789",
        "status": "new",
        "createdAt": created_at,
        "updatedAt": created_at,
        "title": "Fresh Case",
    }
    
    enriched = add_sla_fields(case)
    
    # Age should be ~0.5 hours
    assert 0.4 <= enriched["age_hours"] <= 0.6
    
    # SLA status should be 'ok' (<24h)
    assert enriched["sla_status"] == "ok"


# ============================================================================
# Integration Tests: Endpoint Filtering and Sorting
# ============================================================================


def test_sla_filter_warning_and_breach():
    """Test filtering cases by SLA status (warning and breach)."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    from app.workflow.repo import create_case
    from app.workflow.models import CaseCreateInput, CaseStatus
    from datetime import datetime, timedelta
    
    client = TestClient(app)
    
    # Create test cases with different ages
    now = datetime.utcnow()
    
    # Case 1: Recent (ok)
    case1 = create_case(CaseCreateInput(
        decisionType="test_type",
        title="Recent Case",
        summary="Fresh case",
        status=CaseStatus.IN_REVIEW,
        submissionId="sub-1"
    ))
    # Backdate created_at to 2 hours ago (ok)
    from src.core.db import execute_update
    execute_update(
        "UPDATE cases SET created_at = :created_at, updated_at = :updated_at WHERE id = :id",
        {
            "id": case1.id,
            "created_at": (now - timedelta(hours=2)).isoformat(),
            "updated_at": (now - timedelta(hours=2)).isoformat(),
        }
    )
    
    # Case 2: Warning (30h)
    case2 = create_case(CaseCreateInput(
        decisionType="test_type",
        title="Aging Case",
        summary="Needs attention",
        status=CaseStatus.IN_REVIEW,
        submissionId="sub-2"
    ))
    execute_update(
        "UPDATE cases SET created_at = :created_at, updated_at = :updated_at WHERE id = :id",
        {
            "id": case2.id,
            "created_at": (now - timedelta(hours=30)).isoformat(),
            "updated_at": (now - timedelta(hours=30)).isoformat(),
        }
    )
    
    # Case 3: Breach (80h)
    case3 = create_case(CaseCreateInput(
        decisionType="test_type",
        title="Breached Case",
        summary="Urgent",
        status=CaseStatus.IN_REVIEW,
        submissionId="sub-3"
    ))
    execute_update(
        "UPDATE cases SET created_at = :created_at, updated_at = :updated_at WHERE id = :id",
        {
            "id": case3.id,
            "created_at": (now - timedelta(hours=80)).isoformat(),
            "updated_at": (now - timedelta(hours=80)).isoformat(),
        }
    )
    
    # Test: Filter for warning status
    response = client.get("/workflow/cases?sla_status=warning&limit=1000")
    assert response.status_code == 200
    data = response.json()
    
    # Should only include case2
    warning_ids = [case["id"] for case in data["items"]]
    assert case2.id in warning_ids, "Warning case should be included"
    assert case1.id not in warning_ids, "Ok case should not be included"
    assert case3.id not in warning_ids, "Breach case should not be included"
    
    # Test: Filter for breach status
    response = client.get("/workflow/cases?sla_status=breach&limit=1000")
    assert response.status_code == 200
    data = response.json()
    
    # Should only include case3
    breach_ids = [case["id"] for case in data["items"]]
    assert case3.id in breach_ids, "Breach case should be included"
    assert case1.id not in breach_ids, "Ok case should not be included"
    assert case2.id not in breach_ids, "Warning case should not be included"


def test_sort_by_age_descending():
    """Test sorting cases by age (newest to oldest)."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    # Get all cases sorted by age descending (oldest first when desc)
    response = client.get("/workflow/cases?sortBy=age&sortDir=desc&limit=1000")
    assert response.status_code == 200
    data = response.json()
    
    # Extract age_hours from results
    ages = [case["age_hours"] for case in data["items"]]
    
    # Should be sorted descending (oldest first)
    assert ages == sorted(ages, reverse=True), "Cases should be sorted by age descending"


def test_sort_by_age_ascending():
    """Test sorting cases by age (oldest to newest)."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    # Get all cases sorted by age ascending (newest first when asc)
    response = client.get("/workflow/cases?sortBy=age&sortDir=asc&limit=1000")
    assert response.status_code == 200
    data = response.json()
    
    # Extract age_hours from results
    ages = [case["age_hours"] for case in data["items"]]
    
    # Should be sorted ascending (newest first)
    assert ages == sorted(ages), "Cases should be sorted by age ascending"


def test_sla_fields_present_in_response():
    """Test that all cases include age_hours and sla_status fields."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    response = client.get("/workflow/cases?limit=10")
    assert response.status_code == 200
    data = response.json()
    
    # All cases should have SLA fields
    for case in data["items"]:
        assert "age_hours" in case, "Each case should have age_hours"
        assert "sla_status" in case, "Each case should have sla_status"
        assert case["sla_status"] in ["ok", "warning", "breach"], "SLA status should be valid"
        assert isinstance(case["age_hours"], (int, float)), "age_hours should be numeric"
        assert case["age_hours"] >= 0, "age_hours should be non-negative"


def test_invalid_sla_status_filter():
    """Test that invalid sla_status values return 400 error."""
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    response = client.get("/workflow/cases?sla_status=invalid")
    assert response.status_code == 400, "Should reject invalid sla_status"
    error = response.json()
    assert "sla_status" in error["detail"].lower(), "Error should mention sla_status"
