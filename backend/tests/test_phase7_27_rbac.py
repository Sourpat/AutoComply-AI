"""
Phase 7.27: RBAC + Permissions Hardening Tests

Tests for role-based access control on intelligence endpoints:
- POST /workflow/cases/{id}/intelligence/recompute
- GET /workflow/cases/{id}/audit/export
- POST /workflow/cases/audit/verify
- GET /workflow/cases/{id}/history/{run_id}/evidence
- GET /workflow/cases/{id}/audit/verify

Author: AutoComply AI
Date: 2026-01-20
"""

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from src.api.main import app
from app.auth.permissions import (
    get_user_role,
    get_actor_context,
    has_permission,
    check_admin_unlocked,
)


client = TestClient(app)


# ============================================================================
# Permissions Module Tests
# ============================================================================

def test_get_user_role_from_header():
    """Test role extraction from x-user-role header."""
    from fastapi import Request
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.headers = {"x-user-role": "admin"}
    request.state = Mock()
    request.state.user_role = None
    
    role = get_user_role(request)
    assert role == "admin"


def test_get_user_role_fallback():
    """Test role defaults to verifier when not provided."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.headers = {}
    request.state = Mock()
    request.state.user_role = None
    
    role = get_user_role(request)
    assert role == "verifier"


def test_get_user_role_invalid():
    """Test invalid role defaults to verifier."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.headers = {"x-user-role": "hacker"}
    request.state = Mock()
    request.state.user_role = None
    
    role = get_user_role(request)
    assert role == "verifier"


def test_check_admin_unlocked_query_param():
    """Test admin unlock via query parameter."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.query_params = {"admin_unlocked": "1"}
    request.headers = {}
    
    unlocked = check_admin_unlocked(request)
    assert unlocked is True


def test_check_admin_unlocked_header():
    """Test admin unlock via header."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.query_params = {}
    request.headers = {"x-admin-unlocked": "1"}
    
    unlocked = check_admin_unlocked(request)
    assert unlocked is True


def test_check_admin_unlocked_false():
    """Test admin unlock is false by default."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.query_params = {}
    request.headers = {}
    
    unlocked = check_admin_unlocked(request)
    assert unlocked is False


def test_has_permission_admin():
    """Test admin has permission for admin-only endpoint."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.headers = {"x-user-role": "admin"}
    request.state = Mock()
    request.state.user_role = None
    request.query_params = {}
    
    permitted = has_permission(request, ["admin"])
    assert permitted is True


def test_has_permission_verifier_denied():
    """Test verifier is denied for admin-only endpoint."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.headers = {"x-user-role": "verifier"}
    request.state = Mock()
    request.state.user_role = None
    request.query_params = {}
    
    permitted = has_permission(request, ["admin"])
    assert permitted is False


def test_has_permission_admin_unlocked_bypass():
    """Test admin_unlocked bypasses role check."""
    from unittest.mock import Mock
    
    request = Mock(spec=Request)
    request.headers = {"x-user-role": "verifier"}
    request.state = Mock()
    request.state.user_role = None
    request.query_params = {"admin_unlocked": "1"}
    
    permitted = has_permission(request, ["admin"])
    assert permitted is True


# ============================================================================
# Endpoint RBAC Tests
# ============================================================================

def test_recompute_as_admin():
    """Test admin can recompute intelligence."""
    # This would require setting up test DB and case
    # Simplified test: check endpoint returns 404 for non-existent case (not 403)
    response = client.post(
        "/workflow/cases/nonexistent/intelligence/recompute",
        headers={"x-user-role": "admin"}
    )
    # Should get 200/404/500 (not 403 - authorization passed)
    assert response.status_code in [200, 404, 500]  # Not 403


def test_recompute_as_verifier_forbidden():
    """Test verifier cannot recompute intelligence."""
    response = client.post(
        "/workflow/cases/test-case/intelligence/recompute",
        headers={"x-user-role": "verifier"}
    )
    assert response.status_code == 403
    data = response.json()
    assert "detail" in data
    assert "insufficient_permissions" in str(data["detail"])


def test_recompute_with_admin_unlocked():
    """Test verifier can recompute with admin_unlocked."""
    response = client.post(
        "/workflow/cases/nonexistent/intelligence/recompute?admin_unlocked=1",
        headers={"x-user-role": "verifier"}
    )
    # Should get 200/404/500 (not 403 - bypass worked)
    assert response.status_code in [200, 404, 500]


def test_export_as_admin():
    """Test admin can export audit trail."""
    response = client.get(
        "/workflow/cases/test-case/audit/export",
        headers={"x-user-role": "admin"}
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_export_as_verifier():
    """Test verifier can export audit trail."""
    response = client.get(
        "/workflow/cases/test-case/audit/export",
        headers={"x-user-role": "verifier"}
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_export_no_role_defaults_verifier():
    """Test export without role header defaults to verifier (allowed)."""
    response = client.get(
        "/api/workflow/cases/nonexistent/audit/export"
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_verify_as_admin():
    """Test admin can verify audit export."""
    response = client.post(
        "/workflow/cases/audit/verify",
        headers={"x-user-role": "admin"},
        json={"metadata": {"case_id": "test"}}
    )
    # Should get 200/400 (not 403 - authorization passed)
    assert response.status_code in [200, 400]


def test_verify_as_verifier():
    """Test verifier can verify audit export."""
    response = client.post(
        "/workflow/cases/audit/verify",
        headers={"x-user-role": "verifier"},
        json={"metadata": {"case_id": "test"}}
    )
    # Should get 200/400 (not 403 - authorization passed)
    assert response.status_code in [200, 400]


def test_evidence_snapshot_as_admin():
    """Test admin can get evidence snapshot."""
    response = client.get(
        "/workflow/cases/nonexistent/history/hist_123/evidence",
        headers={"x-user-role": "admin"}
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_evidence_snapshot_as_verifier():
    """Test verifier can get evidence snapshot."""
    response = client.get(
        "/workflow/cases/nonexistent/history/hist_123/evidence",
        headers={"x-user-role": "verifier"}
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_verify_server_side_as_admin():
    """Test admin can use server-side verify."""
    response = client.get(
        "/api/workflow/cases/nonexistent/audit/verify",
        headers={"x-user-role": "admin"}
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_verify_server_side_as_verifier():
    """Test verifier can use server-side verify."""
    response = client.get(
        "/api/workflow/cases/nonexistent/audit/verify",
        headers={"x-user-role": "verifier"}
    )
    # Should get 404 (case not found), not 403
    assert response.status_code == 404


def test_403_error_structure():
    """Test that 403 errors have consistent structure."""
    response = client.post(
        "/workflow/cases/test-case/intelligence/recompute",
        headers={"x-user-role": "verifier"}
    )
    assert response.status_code == 403
    
    data = response.json()
    detail = data["detail"]
    
    # Check error structure
    assert isinstance(detail, dict)
    assert "error" in detail
    assert detail["error"] == "insufficient_permissions"
    assert "message" in detail
    assert "required_roles" in detail
    assert "current_role" in detail
    assert detail["current_role"] == "verifier"
    assert "admin" in detail["required_roles"] or "devsupport" in detail["required_roles"]


def test_devsupport_can_recompute():
    """Test devsupport role can recompute intelligence."""
    response = client.post(
        "/workflow/cases/test-case/intelligence/recompute",
        headers={"x-user-role": "devsupport"}
    )
    # Should get 200/404/500 (not 403 - authorization passed)
    assert response.status_code in [200, 404, 500]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
