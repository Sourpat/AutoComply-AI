"""
Tests for unified verification submissions system.

Tests the console work queue API and CSF submit endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.submissions_store import reset_submission_store


@pytest.fixture(autouse=True)
def reset_store():
    """Reset submission store before each test."""
    reset_submission_store()
    yield
    reset_submission_store()


client = TestClient(app)


def test_console_work_queue_empty():
    """Test console work queue returns empty list when no submissions."""
    response = client.get("/console/work-queue")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["statistics"]["total"] == 0


def test_practitioner_submit_appears_in_console():
    """Test that submitting a practitioner CSF creates a work queue item."""
    # Submit practitioner CSF
    form_data = {
        "account_number": "TEST-PRACT-001",
        "prescriber_name": "Dr. Test Practitioner",
        "dea_number": "AP1234563",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    }
    
    submit_response = client.post("/csf/practitioner/submit", json=form_data)
    assert submit_response.status_code == 200
    submission_id = submit_response.json()["submission_id"]
    trace_id = submit_response.json().get("trace_id")
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1
    
    # Verify submission appears
    item = data["items"][0]
    assert item["submission_id"] == submission_id
    assert item["csf_type"] == "practitioner"
    assert item["status"] == "submitted"
    assert "Practitioner CSF" in item["title"]
    assert item["trace_id"] is not None


def test_facility_submit_appears_in_console():
    """Test that submitting a facility CSF creates a work queue item."""
    form_data = {
        "account_number": "TEST-FAC-001",
        "facility_name": "Test Facility",
        "dea_number": "AF1234567",
        "ship_to_state": "CA",
        "attestation_accepted": True,
    }
    
    submit_response = client.post("/csf/facility/submit", json=form_data)
    assert submit_response.status_code == 200
    submission_id = submit_response.json()["submission_id"]
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    assert data["total"] == 1
    
    item = data["items"][0]
    assert item["csf_type"] == "facility"
    assert "Facility CSF" in item["title"]


def test_hospital_submit_appears_in_console():
    """Test that submitting a hospital CSF creates a work queue item."""
    form_data = {
        "account_number": "TEST-HOSP-001",
        "facility_name": "Test Hospital",
        "dea_number": "AH1234567",
        "pharmacy_license_number": "PH123456",
        "ship_to_state": "NY",
        "attestation_accepted": True,
    }
    
    submit_response = client.post("/csf/hospital/submit", json=form_data)
    assert submit_response.status_code == 200
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    assert data["total"] == 1
    
    item = data["items"][0]
    assert item["csf_type"] == "hospital"
    assert "Hospital CSF" in item["title"]


def test_multiple_submissions_ordered_by_created_at():
    """Test that multiple submissions are ordered newest first."""
    # Submit 3 forms
    for i in range(3):
        form_data = {
            "account_number": f"TEST-{i}",
            "prescriber_name": f"Dr. Test {i}",
            "dea_number": f"AP123456{i}",
            "ship_to_state": "OH",
            "attestation_accepted": True,
        }
        client.post("/csf/practitioner/submit", json=form_data)
    
    # Fetch work queue
    response = client.get("/console/work-queue")
    data = response.json()
    
    assert data["total"] == 3
    assert len(data["items"]) == 3
    
    # Verify newest first
    items = data["items"]
    for i in range(len(items) - 1):
        assert items[i]["created_at"] >= items[i + 1]["created_at"]


def test_work_queue_statistics():
    """Test work queue statistics are calculated correctly."""
    # Submit forms with different priorities
    # High priority (blocked)
    form_blocked = {
        "account_number": "BLOCKED-001",
        "prescriber_name": "Dr. Blocked",
        "dea_number": "INVALID",  # This might cause blocked status
        "ship_to_state": "OH",
        "attestation_accepted": False,
    }
    client.post("/csf/practitioner/submit", json=form_blocked)
    
    # Medium priority (normal)
    form_normal = {
        "account_number": "NORMAL-001",
        "prescriber_name": "Dr. Normal",
        "dea_number": "AP1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    }
    client.post("/csf/practitioner/submit", json=form_normal)
    
    # Fetch work queue
    response = client.get("/console/work-queue")
    data = response.json()
    
    assert data["total"] == 2
    assert data["statistics"]["total"] == 2
    assert data["statistics"]["by_status"]["submitted"] == 2


def test_get_submission_by_id():
    """Test retrieving a specific submission by ID."""
    # Submit form
    form_data = {
        "account_number": "TEST-001",
        "prescriber_name": "Dr. Test",
        "dea_number": "AP1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    }
    
    submit_response = client.post("/csf/practitioner/submit", json=form_data)
    submission_id = submit_response.json()["submission_id"]
    
    # Get submission by ID
    get_response = client.get(f"/console/submissions/{submission_id}")
    assert get_response.status_code == 200
    
    submission = get_response.json()
    assert submission["submission_id"] == submission_id
    assert submission["csf_type"] == "practitioner"
    assert "payload" in submission


def test_get_nonexistent_submission():
    """Test getting a submission that doesn't exist returns 404."""
    response = client.get("/console/submissions/nonexistent-id")
    assert response.status_code == 404
