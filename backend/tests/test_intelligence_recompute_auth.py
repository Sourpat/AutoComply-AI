"""
Test Intelligence Recompute Authorization

Tests for POST /workflow/cases/{case_id}/intelligence/recompute endpoint
authorization with various header and query param combinations.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from app.workflow.repo import create_case
from app.workflow.models import CaseCreateInput


client = TestClient(app)


@pytest.fixture
def test_case():
    """Create a test case for recompute testing."""
    case = create_case(
        CaseCreateInput(
            decisionType="csf",
            title="Test Case for Recompute Auth",
            summary="Testing authorization"
        )
    )
    return case


def test_recompute_allowed_with_admin_role_header(test_case):
    """Test recompute allowed with x-user-role=admin header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"x-user-role": "admin"}
    )
    
    # Should succeed (200 or 201) or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_allowed_with_devsupport_role_header(test_case):
    """Test recompute allowed with x-user-role=devsupport header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"x-user-role": "devsupport"}
    )
    
    # Should succeed (200 or 201) or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_allowed_with_x_role_admin(test_case):
    """Test recompute allowed with x-role=admin header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"x-role": "admin"}
    )
    
    # Should succeed or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_allowed_with_legacy_header(test_case):
    """Test recompute allowed with X-AutoComply-Role=admin header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"X-AutoComply-Role": "admin"}
    )
    
    # Should succeed or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_allowed_with_admin_unlocked_query_param(test_case):
    """Test recompute allowed with ?admin_unlocked=1 query param."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute?admin_unlocked=1"
    )
    
    # Should succeed or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_allowed_with_admin_unlocked_true(test_case):
    """Test recompute allowed with ?admin_unlocked=true query param."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute?admin_unlocked=true"
    )
    
    # Should succeed or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_allowed_with_admin_unlocked_header(test_case):
    """Test recompute allowed with x-admin-unlocked=1 header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"x-admin-unlocked": "1"}
    )
    
    # Should succeed or at least not be 403
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_recompute_forbidden_with_verifier_role(test_case):
    """Test recompute forbidden with x-user-role=verifier header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"x-user-role": "verifier"}
    )
    
    # Should be 403 Forbidden
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    assert "Only admin and devsupport" in response.json()["detail"]


def test_recompute_forbidden_without_headers(test_case):
    """Test recompute forbidden without any auth headers or params."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute"
    )
    
    # Should be 403 Forbidden
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    assert "Only admin and devsupport" in response.json()["detail"]


def test_recompute_forbidden_with_invalid_role(test_case):
    """Test recompute forbidden with invalid role header."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={"x-user-role": "hacker"}
    )
    
    # Should be 403 Forbidden (invalid role defaults to verifier)
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    assert "Only admin and devsupport" in response.json()["detail"]


def test_recompute_with_combined_headers(test_case):
    """Test recompute with multiple headers (x-user-role takes priority)."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute",
        headers={
            "x-user-role": "admin",
            "X-AutoComply-Role": "verifier"  # Should be ignored
        }
    )
    
    # Should succeed because x-user-role=admin has priority
    assert response.status_code != 403, f"Expected non-403, got {response.status_code}: {response.text}"


def test_get_intelligence_works_without_auth(test_case):
    """Test GET intelligence endpoint works without special auth (regression test)."""
    response = client.get(
        f"/workflow/cases/{test_case.id}/intelligence"
    )
    
    # Should succeed (200 or at least not 403)
    # This verifies we didn't break the GET endpoint
    assert response.status_code != 403, f"GET endpoint should not require auth, got {response.status_code}"
