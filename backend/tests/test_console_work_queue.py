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


def test_facility_csf_work_queue_decision_status_ok_to_ship():
    """
    Test that a complete facility CSF submission shows ok_to_ship in work queue.
    
    Verifies:
    - Happy-path submission has decision_status == "ok_to_ship"
    - Subtitle contains "Facility CSF" (not "Hospital CSF")
    - Stored payload contains actual form data (not empty defaults)
    """
    # Complete happy-path facility payload
    form_data = {
        "facility_name": "Happy Path Facility",
        "facility_type": "facility",
        "account_number": "ACCT-HAPPY-001",
        "pharmacy_license_number": "PHOH-12345",
        "dea_number": "BF1234567",
        "pharmacist_in_charge_name": "Dr. Jane Smith",
        "pharmacist_contact_phone": "555-0123",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "oxy-test",
                "name": "Oxycodone 10mg",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
            }
        ],
    }
    
    # Submit facility CSF
    submit_response = client.post("/csf/facility/submit", json=form_data)
    assert submit_response.status_code == 200
    submission_id = submit_response.json()["submission_id"]
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    assert data["total"] == 1
    
    item = data["items"][0]
    assert item["submission_id"] == submission_id
    assert item["csf_type"] == "facility"
    assert item["decision_status"] == "ok_to_ship"
    assert "Facility CSF" in item["title"]
    assert "Submitted for verification" in item["subtitle"]
    
    # Verify payload contains actual data (not empty defaults)
    payload = item["payload"]
    assert payload is not None
    assert payload["form"]["facility_name"] == "Happy Path Facility"
    assert payload["form"]["pharmacy_license_number"] == "PHOH-12345"
    assert payload["form"]["attestation_accepted"] is True
    assert len(payload["form"]["controlled_substances"]) == 1
    assert payload["decision"]["status"] == "ok_to_ship"


def test_facility_csf_work_queue_decision_status_blocked():
    """
    Test that an incomplete facility CSF submission shows blocked in work queue.
    
    Verifies:
    - Incomplete submission has decision_status == "blocked"
    - Subtitle contains "Blocked" and "Facility CSF" (not "Hospital CSF")
    """
    # Incomplete facility payload (missing required fields)
    form_data = {
        "facility_name": "",  # Missing
        "facility_type": "facility",
        "account_number": "ACCT-BLOCKED-001",
        "pharmacy_license_number": "",  # Missing
        "dea_number": "",  # Missing
        "pharmacist_in_charge_name": "",  # Missing
        "ship_to_state": "",  # Missing
        "attestation_accepted": False,  # Not accepted
    }
    
    # Submit facility CSF
    submit_response = client.post("/csf/facility/submit", json=form_data)
    assert submit_response.status_code == 200
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    assert data["total"] == 1
    
    item = data["items"][0]
    assert item["csf_type"] == "facility"
    assert item["decision_status"] == "blocked"
    assert "Blocked:" in item["subtitle"]
    # Verify subtitle mentions "Facility CSF" not "Hospital CSF"
    assert "Facility CSF" in item["subtitle"]
    assert "Hospital CSF" not in item["subtitle"]


def test_work_queue_trace_id_not_null():
    """
    Test that all work queue items have non-null trace_id for linking.
    
    Regression test for P0 bug: Work queue items must include trace_id
    so the UI can link to the trace viewer for debugging/replay.
    """
    # Submit 3 different CSF types
    client.post("/csf/practitioner/submit", json={
        "account_number": "PRACT-001",
        "prescriber_name": "Dr. A",
        "dea_number": "AP1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    })
    
    client.post("/csf/facility/submit", json={
        "facility_name": "Facility B",
        "account_number": "FAC-002",
        "dea_number": "BF2345678",
        "ship_to_state": "CA",
        "attestation_accepted": True,
    })
    
    client.post("/csf/hospital/submit", json={
        "facility_name": "Hospital C",
        "account_number": "HOSP-003",
        "dea_number": "CH3456789",
        "ship_to_state": "NY",
        "attestation_accepted": True,
    })
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    assert data["total"] == 3
    
    # Verify all items have non-null trace_id
    for item in data["items"]:
        assert item["trace_id"] is not None, f"Item {item['submission_id']} has null trace_id"
        assert len(item["trace_id"]) > 0, f"Item {item['submission_id']} has empty trace_id"
        # Trace IDs should be valid UUID format (basic check)
        assert "-" in item["trace_id"], f"Invalid trace_id format: {item['trace_id']}"


def test_work_queue_decision_status_mapping():
    """
    Test that decision_status correctly reflects ok_to_ship vs blocked.
    
    Regression test: Frontend was incorrectly mapping statuses because
    backend wasn't returning decision_status field correctly.
    """
    # Submit ok_to_ship case
    client.post("/csf/facility/submit", json={
        "facility_name": "Complete Facility",
        "account_number": "OK-001",
        "pharmacy_license_number": "PH12345",
        "dea_number": "BF1234567",
        "pharmacist_in_charge_name": "Dr. Smith",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    })
    
    # Submit blocked case
    client.post("/csf/facility/submit", json={
        "facility_name": "",  # Missing required field
        "account_number": "BLOCKED-002",
        "attestation_accepted": False,  # Not accepted
    })
    
    # Fetch work queue
    queue_response = client.get("/console/work-queue")
    assert queue_response.status_code == 200
    
    data = queue_response.json()
    items_by_account = {item["payload"]["form"]["account_number"]: item for item in data["items"]}
    
    # Verify ok_to_ship item
    ok_item = items_by_account["OK-001"]
    assert ok_item["decision_status"] == "ok_to_ship"
    assert ok_item["status"] == "submitted"  # Status remains "submitted"
    
    # Verify blocked item
    blocked_item = items_by_account["BLOCKED-002"]
    assert blocked_item["decision_status"] == "blocked"
    assert blocked_item["status"] == "submitted"


def test_update_submission_status():
    """Test updating submission status via PATCH endpoint."""
    # Create a submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-001",
        "prescriber_name": "Dr. Test",
        "dea_number": "AP1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Update to in_review
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "in_review"}
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["status"] == "in_review"
    assert data["updated_at"] is not None
    
    # Verify in queue
    queue_response = client.get("/console/work-queue")
    item = queue_response.json()["items"][0]
    assert item["status"] == "in_review"


def test_update_submission_to_approved():
    """Test status transition: submitted -> in_review -> approved."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-002",
        "prescriber_name": "Dr. Reviewer",
        "dea_number": "AP1234568",
        "ship_to_state": "NY",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Start review
    client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "in_review"}
    )
    
    # Approve
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "approved"}
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "approved"


def test_update_submission_to_rejected():
    """Test rejecting a submission."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-003",
        "prescriber_name": "Dr. Reject",
        "dea_number": "AP1234569",
        "ship_to_state": "TX",
        "attestation_accepted": False,  # Will be blocked
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Reject
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "rejected"}
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "rejected"


def test_update_submission_reviewer_notes():
    """Test adding reviewer notes to a submission."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-004",
        "prescriber_name": "Dr. Notes",
        "dea_number": "AP1234570",
        "ship_to_state": "FL",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Add notes
    notes = "Verified DEA number against ARCOS database. All checks passed."
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"reviewer_notes": notes}
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["reviewer_notes"] == notes
    
    # Verify notes persist
    get_response = client.get(f"/console/submissions/{submission_id}")
    assert get_response.json()["reviewer_notes"] == notes


def test_update_submission_status_and_notes():
    """Test updating both status and notes in single request."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-005",
        "prescriber_name": "Dr. Both",
        "dea_number": "AP1234571",
        "ship_to_state": "CA",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Update both
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={
            "status": "approved",
            "reviewer_notes": "Approved after manual verification of credentials."
        }
    )
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["status"] == "approved"
    assert "manual verification" in data["reviewer_notes"]


def test_update_submission_not_found():
    """Test updating non-existent submission returns 404."""
    update_response = client.patch(
        "/console/work-queue/nonexistent-id",
        json={"status": "approved"}
    )
    assert update_response.status_code == 404


def test_update_submission_no_fields():
    """Test updating with no fields returns 400."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-006",
        "prescriber_name": "Dr. Empty",
        "dea_number": "AP1234572",
        "ship_to_state": "WA",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Try to update with no fields
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={}
    )
    assert update_response.status_code == 400


def test_statistics_count_by_status():
    """Test that statistics correctly count submissions by status."""
    # Create submissions with different statuses
    # Submitted
    for i in range(3):
        client.post("/csf/practitioner/submit", json={
            "account_number": f"SUB-{i}",
            "prescriber_name": f"Dr. Submitted {i}",
            "dea_number": f"AP123457{i}",
            "ship_to_state": "OH",
            "attestation_accepted": True,
        })
    
    # Create one and move to in_review
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "REV-001",
        "prescriber_name": "Dr. Review",
        "dea_number": "AP1234580",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    })
    client.patch(
        f"/console/work-queue/{submit_response.json()['submission_id']}",
        json={"status": "in_review"}
    )
    
    # Create one and approve
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "APP-001",
        "prescriber_name": "Dr. Approved",
        "dea_number": "AP1234581",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    })
    client.patch(
        f"/console/work-queue/{submit_response.json()['submission_id']}",
        json={"status": "approved"}
    )
    
    # Get statistics
    queue_response = client.get("/console/work-queue")
    stats = queue_response.json()["statistics"]
    
    assert stats["total"] == 5
    assert stats["by_status"]["submitted"] == 3
    assert stats["by_status"]["in_review"] == 1
    assert stats["by_status"]["approved"] == 1


def test_reviewed_by_and_reviewed_at_fields():
    """Test that reviewed_by and reviewed_at are set correctly."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-AUDIT-001",
        "prescriber_name": "Dr. Audit",
        "dea_number": "AP1234590",
        "ship_to_state": "CA",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Approve with custom reviewed_by
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "approved", "reviewed_by": "jane@example.com"}
    )
    
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["status"] == "approved"
    assert data["reviewed_by"] == "jane@example.com"
    assert data["reviewed_at"] is not None
    assert isinstance(data["reviewed_at"], str)  # Should be ISO timestamp


def test_reviewed_by_defaults_to_admin():
    """Test that reviewed_by defaults to 'admin' when not provided."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-AUDIT-002",
        "prescriber_name": "Dr. Default",
        "dea_number": "AP1234591",
        "ship_to_state": "FL",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Approve without reviewed_by (should default to "admin")
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "approved"}
    )
    
    assert update_response.status_code == 200
    data = update_response.json()
    assert data["reviewed_by"] == "admin"
    assert data["reviewed_at"] is not None


def test_reviewed_at_only_set_on_final_decision():
    """Test that reviewed_at is only set when status becomes approved/rejected."""
    # Create submission
    submit_response = client.post("/csf/practitioner/submit", json={
        "account_number": "TEST-AUDIT-003",
        "prescriber_name": "Dr. Timeline",
        "dea_number": "AP1234592",
        "ship_to_state": "WA",
        "attestation_accepted": True,
    })
    submission_id = submit_response.json()["submission_id"]
    
    # Start review (should not set reviewed_at)
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "in_review"}
    )
    assert update_response.json()["reviewed_at"] is None
    
    # Approve (should set reviewed_at)
    update_response = client.patch(
        f"/console/work-queue/{submission_id}",
        json={"status": "approved", "reviewed_by": "john@example.com"}
    )
    assert update_response.json()["reviewed_at"] is not None
    assert update_response.json()["reviewed_by"] == "john@example.com"

