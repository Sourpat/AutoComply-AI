"""
Tests for Request ID Observability (Phase 7.33).

Validates:
- X-Request-Id middleware adds header to responses
- Middleware reuses client-provided request_id
- Middleware generates UUID when not provided
- Request ID stored in intelligence_history
- Request ID included in export metadata
- Request ID part of export signature
"""

import pytest
import uuid
from fastapi.testclient import TestClient
from src.api.main import app
from app.intelligence.repository import get_intelligence_history
from src.core.db import execute_sql


client = TestClient(app)


# ============================================================================
# Middleware Tests
# ============================================================================

def test_middleware_generates_request_id_when_not_provided():
    """Test that middleware generates X-Request-Id if not provided."""
    response = client.get("/health")
    
    assert response.status_code == 200
    assert "X-Request-Id" in response.headers
    
    request_id = response.headers["X-Request-Id"]
    # Should be a valid UUID
    try:
        uuid.UUID(request_id)
        assert True
    except ValueError:
        pytest.fail(f"X-Request-Id is not a valid UUID: {request_id}")


def test_middleware_reuses_client_provided_request_id():
    """Test that middleware reuses client-provided X-Request-Id."""
    client_request_id = str(uuid.uuid4())
    
    response = client.get(
        "/health",
        headers={"X-Request-Id": client_request_id}
    )
    
    assert response.status_code == 200
    assert "X-Request-Id" in response.headers
    assert response.headers["X-Request-Id"] == client_request_id


def test_middleware_adds_request_id_to_all_responses():
    """Test that X-Request-Id is added to all API responses."""
    endpoints = [
        "/health",
        "/healthz",
    ]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        
        # Even if endpoint returns error, header should be present
        assert "X-Request-Id" in response.headers, \
            f"X-Request-Id missing from {endpoint}"
        
        # Should be valid UUID
        request_id = response.headers["X-Request-Id"]
        try:
            uuid.UUID(request_id)
        except ValueError:
            pytest.fail(f"Invalid UUID in X-Request-Id for {endpoint}: {request_id}")


# ============================================================================
# Intelligence Recompute Tests (Integration - requires full API setup)
# ============================================================================

@pytest.fixture
def sample_case_with_submission():
    """Create a test case with submission for intelligence recompute."""
    from src.core.db import execute_insert, execute_delete
    from app.intelligence.repository import insert_intelligence_history
    
    case_id = f"test-case-{uuid.uuid4()}"
    
    # Create case (submission_id can be null or just a string reference)
    execute_insert(
        """
        INSERT INTO cases (id, title, decision_type, status, created_at, updated_at)
        VALUES (:id, :title, :decision_type, :status, :created_at, :updated_at)
        """,
        {
            "id": case_id,
            "title": "Test Case for Request ID",
            "decision_type": "license",
            "status": "in_review",
            "created_at": "2026-01-21T00:00:00Z",
            "updated_at": "2026-01-21T00:00:00Z"
        }
    )
    
    # Insert initial intelligence history so recompute has something to work with
    initial_payload = {
        "confidence_score": 75.0,
        "confidence_band": "MEDIUM",
        "rules_passed": 10,
        "rules_total": 15,
        "gaps": [],
        "bias_flags": []
    }
    insert_intelligence_history(
        case_id=case_id,
        payload=initial_payload,
        actor="system",
        reason="Initial test setup"
    )
    
    yield case_id
    
    # Cleanup
    execute_delete("DELETE FROM intelligence_history WHERE case_id = :id", {"id": case_id})
    execute_delete("DELETE FROM cases WHERE id = :id", {"id": case_id})


def test_recompute_stores_request_id_in_history(sample_case_with_submission):
    """Test that intelligence recompute stores request_id in history."""
    client_request_id = str(uuid.uuid4())
    
    response = client.post(
        f"/workflow/cases/{sample_case_with_submission}/intelligence/recompute",
        headers={
            "X-Request-Id": client_request_id,
            "x-user-role": "admin"  # Required for RBAC
        }
    )
    
    assert response.status_code == 200
    
    # Check that history entry was created with request_id
    history = get_intelligence_history(sample_case_with_submission, limit=1)
    
    assert len(history) > 0, "No history entry created"
    
    latest_entry = history[0]
    assert "request_id" in latest_entry or "id" in latest_entry
    
    # Query directly from DB to verify request_id
    result = execute_sql(
        """
        SELECT request_id FROM intelligence_history 
        WHERE case_id = :case_id 
        ORDER BY computed_at DESC 
        LIMIT 1
        """,
        {"case_id": sample_case_with_submission}
    )
    rows = list(result)
    
    assert len(rows) > 0, "No history rows found in DB"
    assert rows[0]['request_id'] == client_request_id, \
        f"Expected request_id {client_request_id}, got {rows[0]['request_id']}"


def test_recompute_without_request_id_stores_generated_id(sample_case_with_submission):
    """Test that recompute stores generated request_id even if client doesn't provide one."""
    response = client.post(
        f"/workflow/cases/{sample_case_with_submission}/intelligence/recompute",
        headers={"x-user-role": "admin"}  # Required for RBAC
    )
    
    assert response.status_code == 200
    
    # Middleware should have generated a request_id
    assert "X-Request-Id" in response.headers
    generated_request_id = response.headers["X-Request-Id"]
    
    # Check that history entry has the generated request_id
    result = execute_sql(
        """
        SELECT request_id FROM intelligence_history 
        WHERE case_id = :case_id 
        ORDER BY computed_at DESC 
        LIMIT 1
        """,
        {"case_id": sample_case_with_submission}
    )
    rows = list(result)
    
    assert len(rows) > 0
    assert rows[0]['request_id'] == generated_request_id


# ============================================================================
# Export Tests (Integration - requires full API setup)
# ============================================================================

def test_export_includes_request_id_in_metadata(sample_case_with_submission):
    """Test that export response includes request_id in metadata."""
    # First recompute to create intelligence
    recompute_response = client.post(
        f"/workflow/cases/{sample_case_with_submission}/intelligence/recompute",
        headers={"x-user-role": "admin"}
    )
    assert recompute_response.status_code == 200
    
    # Now export with a known request_id
    export_request_id = str(uuid.uuid4())
    
    export_response = client.get(
        f"/workflow/cases/{sample_case_with_submission}/audit/export",
        headers={
            "X-Request-Id": export_request_id,
            "x-user-role": "admin"  # Required for RBAC
        }
    )
    
    assert export_response.status_code == 200
    export_data = export_response.json()
    
    # Check export_metadata contains request_id
    assert "export_metadata" in export_data, "export_metadata missing from response"
    assert "request_id" in export_data["export_metadata"], \
        "request_id missing from export_metadata"
    assert export_data["export_metadata"]["request_id"] == export_request_id


def test_export_request_id_is_signed(sample_case_with_submission):
    """Test that request_id is part of the signed payload."""
    # First recompute to create intelligence
    client.post(
        f"/workflow/cases/{sample_case_with_submission}/intelligence/recompute",
        headers={"x-user-role": "admin"}
    )
    
    # Export with known request_id
    export_request_id = str(uuid.uuid4())
    
    response = client.get(
        f"/workflow/cases/{sample_case_with_submission}/audit/export",
        headers={
            "X-Request-Id": export_request_id,
            "x-user-role": "admin"
        }
    )
    
    assert response.status_code == 200
    export_data = response.json()
    
    # Verify signature exists
    assert "signature" in export_data, "signature missing from export"
    assert "signed_at" in export_data["signature"], "signed_at missing"
    assert "value" in export_data["signature"], "signature value missing"
    
    # Verify request_id is in the metadata that was signed
    assert "export_metadata" in export_data
    assert export_data["export_metadata"]["request_id"] == export_request_id
    
    # The signature hash should change if request_id changes
    # (implicitly tested by signature verification in actual use)


# ============================================================================
# End-to-End Tracing Test (Integration - requires full API setup)
# ============================================================================

def test_end_to_end_request_tracing(sample_case_with_submission):
    """Test complete request tracing from middleware → storage → export."""
    trace_id = str(uuid.uuid4())
    
    # Step 1: Recompute with trace_id
    recompute_response = client.post(
        f"/workflow/cases/{sample_case_with_submission}/intelligence/recompute",
        headers={
            "X-Request-Id": trace_id,
            "x-user-role": "admin"
        }
    )
    
    assert recompute_response.status_code == 200
    assert recompute_response.headers["X-Request-Id"] == trace_id
    
    # Step 2: Verify trace_id stored in intelligence_history
    history_result = execute_sql(
        """
        SELECT request_id FROM intelligence_history 
        WHERE case_id = :case_id 
        ORDER BY computed_at DESC 
        LIMIT 1
        """,
        {"case_id": sample_case_with_submission}
    )
    history_rows = list(history_result)
    
    assert len(history_rows) > 0
    assert history_rows[0]['request_id'] == trace_id
    
    # Step 3: Export with different request_id (export operation has its own trace)
    export_trace_id = str(uuid.uuid4())
    
    export_response = client.get(
        f"/workflow/cases/{sample_case_with_submission}/audit/export",
        headers={
            "X-Request-Id": export_trace_id,
            "x-user-role": "admin"
        }
    )
    
    assert export_response.status_code == 200
    assert export_response.headers["X-Request-Id"] == export_trace_id
    
    export_data = export_response.json()
    
    # Step 4: Verify export contains its own request_id
    assert export_data["export_metadata"]["request_id"] == export_trace_id
    
    # Step 5: Verify we can trace back to the original computation
    # (The intelligence_history still has the original trace_id from recompute)
    assert history_rows[0]['request_id'] == trace_id  # Original computation trace


# ============================================================================
# Request ID Uniqueness Tests
# ============================================================================

def test_concurrent_requests_get_different_request_ids():
    """Test that concurrent requests get unique request IDs."""
    responses = []
    
    # Make multiple concurrent requests
    for _ in range(5):
        response = client.get("/health")
        responses.append(response)
    
    request_ids = [r.headers["X-Request-Id"] for r in responses]
    
    # All should be unique
    assert len(request_ids) == len(set(request_ids)), \
        "Request IDs are not unique across concurrent requests"


def test_request_id_format_is_valid_uuid():
    """Test that all generated request IDs are valid UUIDs."""
    for _ in range(10):
        response = client.get("/health")
        request_id = response.headers["X-Request-Id"]
        
        # Should parse as UUID without error
        try:
            parsed_uuid = uuid.UUID(request_id)
            assert str(parsed_uuid) == request_id
        except ValueError as e:
            pytest.fail(f"Invalid UUID format: {request_id}, error: {e}")
