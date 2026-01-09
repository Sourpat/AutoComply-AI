"""
Test trace storage and retrieval end-to-end.

Verifies:
1. CSF Facility evaluation returns trace_id
2. Trace is stored in database
3. GET /workflow/traces/{trace_id} retrieves the trace
4. 404 for unknown trace_id
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from app.workflow.trace_repo import get_trace_repo

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_traces():
    """Clear traces before each test."""
    # Traces are stored in SQLite, no need to clear for now
    # But we can add cleanup if needed
    yield


def test_csf_facility_stores_and_retrieves_trace():
    """
    Test end-to-end trace flow:
    1. Submit CSF facility evaluation
    2. Capture trace_id from response
    3. Retrieve trace via GET /workflow/traces/{trace_id}
    4. Verify trace contains expected data
    """
    # Step 1: Submit CSF facility evaluation
    payload = {
        "facility_name": "Test Trace Facility",
        "facility_type": "facility",
        "account_number": "TRACE-001",
        "pharmacy_license_number": "PH-TRACE-123",
        "dea_number": "BT9876543",
        "pharmacist_in_charge_name": "Dr. Trace Test",
        "pharmacist_contact_phone": "555-0199",
        "ship_to_state": "CA",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "trace-test-1",
                "name": "Test Substance",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
                "strength": "10mg",
                "quantity": 50
            }
        ],
        "internal_notes": "Trace storage test"
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    
    data = resp.json()
    assert "trace_id" in data
    assert data["trace_id"]
    
    trace_id = data["trace_id"]
    
    # Step 2: Retrieve trace via GET endpoint
    trace_resp = client.get(f"/workflow/traces/{trace_id}")
    assert trace_resp.status_code == 200
    
    trace_data = trace_resp.json()
    assert "trace_id" in trace_data
    assert "trace" in trace_data
    assert trace_data["trace_id"] == trace_id
    
    # Step 3: Verify trace contains expected fields
    trace = trace_data["trace"]
    assert trace["trace_id"] == trace_id
    assert trace["engine_family"] == "csf"
    assert trace["decision_type"] == "csf_facility"
    
    # Verify form data is stored
    assert "form" in trace
    assert trace["form"]["facility_name"] == "Test Trace Facility"
    assert trace["form"]["account_number"] == "TRACE-001"
    
    # Verify decision data is stored
    assert "decision" in trace
    assert "status" in trace["decision"]
    assert "reason" in trace["decision"]
    assert trace["decision"]["trace_id"] == trace_id


def test_trace_not_found_returns_404():
    """Test that requesting a non-existent trace returns 404."""
    unknown_trace_id = "unknown-trace-999999"
    
    resp = client.get(f"/workflow/traces/{unknown_trace_id}")
    assert resp.status_code == 404
    
    error_data = resp.json()
    assert "detail" in error_data
    assert unknown_trace_id in error_data["detail"]


def test_trace_persists_across_requests():
    """Test that traces persist and can be retrieved multiple times."""
    # Submit evaluation
    payload = {
        "facility_name": "Persistence Test",
        "facility_type": "facility",
        "pharmacy_license_number": "PH-PERSIST-123",
        "dea_number": "BP1234567",
        "pharmacist_in_charge_name": "Dr. Persist",
        "ship_to_state": "NY",
        "attestation_accepted": True,
    }
    
    eval_resp = client.post("/csf/facility/evaluate", json=payload)
    assert eval_resp.status_code == 200
    
    trace_id = eval_resp.json()["trace_id"]
    
    # Retrieve trace multiple times
    for _ in range(3):
        trace_resp = client.get(f"/workflow/traces/{trace_id}")
        assert trace_resp.status_code == 200
        trace_data = trace_resp.json()
        assert trace_data["trace_id"] == trace_id
        assert trace_data["trace"]["form"]["facility_name"] == "Persistence Test"


def test_trace_repo_direct_storage():
    """Test trace repo directly for storage and retrieval."""
    trace_repo = get_trace_repo()
    
    test_trace_id = "direct-test-trace-123"
    test_trace_data = {
        "trace_id": test_trace_id,
        "engine_family": "test",
        "decision_type": "test_decision",
        "test_field": "test_value",
        "nested": {
            "field1": "value1",
            "field2": 42
        }
    }
    
    # Store trace
    trace_repo.store_trace(
        trace_id=test_trace_id,
        trace_data=test_trace_data,
        engine_family="test",
        decision_type="test_decision",
        status="test_status"
    )
    
    # Retrieve trace
    retrieved = trace_repo.get_trace(test_trace_id)
    assert retrieved is not None
    assert retrieved["trace_id"] == test_trace_id
    assert retrieved["engine_family"] == "test"
    assert retrieved["test_field"] == "test_value"
    assert retrieved["nested"]["field1"] == "value1"
    assert retrieved["nested"]["field2"] == 42


def test_multiple_traces_stored_independently():
    """Test that multiple traces are stored and retrieved independently."""
    payloads = [
        {
            "facility_name": f"Facility {i}",
            "facility_type": "facility",
            "pharmacy_license_number": f"PH-{i:03d}",
            "dea_number": f"BM{i:07d}",
            "pharmacist_in_charge_name": f"Dr. Test {i}",
            "ship_to_state": "TX",
            "attestation_accepted": True,
        }
        for i in range(1, 4)
    ]
    
    trace_ids = []
    
    # Submit multiple evaluations
    for payload in payloads:
        resp = client.post("/csf/facility/evaluate", json=payload)
        assert resp.status_code == 200
        trace_ids.append(resp.json()["trace_id"])
    
    # Verify each trace can be retrieved independently
    for i, trace_id in enumerate(trace_ids, 1):
        trace_resp = client.get(f"/workflow/traces/{trace_id}")
        assert trace_resp.status_code == 200
        
        trace_data = trace_resp.json()
        assert trace_data["trace_id"] == trace_id
        assert trace_data["trace"]["form"]["facility_name"] == f"Facility {i}"
        assert trace_data["trace"]["form"]["pharmacy_license_number"] == f"PH-{i:03d}"


def test_trace_contains_complete_decision_outcome():
    """Test that trace stores complete decision outcome with all fields."""
    payload = {
        "facility_name": "Complete Decision Test",
        "facility_type": "hospital",
        "pharmacy_license_number": "PH-COMPLETE",
        "dea_number": "BC9999999",
        "pharmacist_in_charge_name": "Dr. Complete",
        "ship_to_state": "FL",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "complete-1",
                "name": "Complete Test Drug",
                "ndc": "99999-999-99",
                "dea_schedule": "III",
                "dosage_form": "capsule",
            }
        ]
    }
    
    eval_resp = client.post("/csf/facility/evaluate", json=payload)
    assert eval_resp.status_code == 200
    
    trace_id = eval_resp.json()["trace_id"]
    
    # Retrieve and verify complete trace
    trace_resp = client.get(f"/workflow/traces/{trace_id}")
    assert trace_resp.status_code == 200
    
    trace = trace_resp.json()["trace"]
    
    # Verify decision has all expected fields
    decision = trace["decision"]
    assert "status" in decision
    assert "reason" in decision
    assert "trace_id" in decision
    assert decision["trace_id"] == trace_id
    
    # Verify form preservation
    assert trace["form"]["facility_name"] == "Complete Decision Test"
    assert len(trace["form"]["controlled_substances"]) == 1
    assert trace["form"]["controlled_substances"][0]["name"] == "Complete Test Drug"


def test_trace_endpoint_appears_in_openapi():
    """Test that the trace endpoint appears in OpenAPI documentation."""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    
    openapi_spec = resp.json()
    paths = openapi_spec.get("paths", {})
    
    # Verify trace endpoint exists
    trace_path = "/workflow/traces/{trace_id}"
    assert trace_path in paths
    
    # Verify GET method exists
    assert "get" in paths[trace_path]
    
    # Verify response schemas
    get_spec = paths[trace_path]["get"]
    assert "200" in get_spec["responses"]
    # Note: 404 is handled via HTTPException but not auto-documented in OpenAPI
    
    # Verify 200 response has correct schema
    response_200 = get_spec["responses"]["200"]
    assert "content" in response_200
    assert "application/json" in response_200["content"]
