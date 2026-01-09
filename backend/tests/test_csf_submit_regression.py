"""
Regression tests for CSF submit endpoints to prevent P0 bugs.

Tests verify:
1. Happy path submissions result in ok_to_ship status (not blocked)
2. payload.decision.trace_id is populated and matches top-level trace_id
3. payload.form contains actual form data (not empty defaults)
4. Blocked submissions correctly show blocked status
"""
import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.submissions_store import get_submission_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_submissions():
    """Clear submissions before each test"""
    store = get_submission_store()
    store._store.clear()
    yield


def test_practitioner_submit_happy_path_ok_to_ship():
    """
    REGRESSION TEST: Happy path practitioner CSF should result in ok_to_ship, not blocked.
    
    Verifies:
    - Decision status is ok_to_ship
    - payload.form has actual data (facility_name, dea_number, etc.)
    - payload.decision.trace_id matches top-level trace_id
    - attestation_accepted is True in stored payload
    """
    payload = {
        "facility_name": "Hudson Valley Primary Care",
        "facility_type": "group_practice",
        "account_number": "ACCT-22001",
        "practitioner_name": "Dr. Alicia Patel",
        "state_license_number": "NY-1023498",
        "dea_number": "AP1234567",
        "ship_to_state": "NY",
        "attestation_accepted": True,
        "internal_notes": "Established primary care practice.",
        "controlled_substances": [
            {
                "id": "cs_clonazepam_0_5mg",
                "name": "Clonazepam 0.5mg",
                "ndc": "00093-0063-01",
                "dea_schedule": "IV",
                "schedule": "IV",
            }
        ],
    }

    resp = client.post("/csf/practitioner/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Should be submitted successfully
    assert data["status"] == "submitted"
    assert data["decision_status"] == "ok_to_ship"
    assert data["submission_id"]
    assert data["trace_id"]
    
    # Verify stored submission
    store = get_submission_store()
    submission = store.get_submission(data["submission_id"])
    assert submission is not None
    assert submission.trace_id == data["trace_id"]
    
    # REGRESSION: Verify payload.form has actual data (not empty strings)
    assert submission.payload["form"]["facility_name"] == "Hudson Valley Primary Care"
    assert submission.payload["form"]["dea_number"] == "AP1234567"
    assert submission.payload["form"]["practitioner_name"] == "Dr. Alicia Patel"
    assert submission.payload["form"]["attestation_accepted"] is True
    
    # REGRESSION: Verify payload.decision.trace_id is populated
    assert submission.payload["decision"]["trace_id"] == data["trace_id"]
    
    # REGRESSION: Verify decision status is ok_to_ship (not blocked)
    assert submission.payload["decision"]["status"] == "ok_to_ship"


def test_practitioner_submit_blocked_path():
    """
    Verify blocked submissions correctly show blocked status.
    
    Verifies:
    - Missing attestation results in blocked
    - payload.decision.trace_id is populated
    - Decision reason explains why blocked
    """
    payload = {
        "facility_name": "Test Clinic",
        "facility_type": "clinic",
        "account_number": "ACCT-99999",
        "practitioner_name": "Dr. Test",
        "state_license_number": "TX-12345",
        "dea_number": "DT1234567",
        "ship_to_state": "TX",
        "attestation_accepted": False,  # Not accepted → should block
        "internal_notes": "",
    }

    resp = client.post("/csf/practitioner/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Should be submitted but blocked
    assert data["status"] == "submitted"
    assert data["decision_status"] == "blocked"
    assert "attestation" in data["reason"].lower()
    
    # Verify stored submission
    store = get_submission_store()
    submission = store.get_submission(data["submission_id"])
    assert submission is not None
    
    # Verify payload.decision.trace_id is populated
    assert submission.payload["decision"]["trace_id"] == data["trace_id"]
    
    # Verify decision status and reason
    assert submission.payload["decision"]["status"] == "blocked"
    assert "attestation" in submission.payload["decision"]["reason"].lower()


def test_facility_submit_happy_path_ok_to_ship():
    """
    REGRESSION TEST: Happy path facility CSF should result in ok_to_ship, not blocked.
    
    Verifies:
    - Decision status is ok_to_ship
    - payload.form has actual data
    - payload.decision.trace_id matches top-level trace_id
    """
    payload = {
        "facility_name": "Memorial Hospital",
        "facility_type": "hospital",
        "account_number": "ACCT-55001",
        "dea_number": "FM1234567",
        "pharmacy_license_number": "OH-PHARM-12345",  # Required for facility/hospital
        "pharmacist_in_charge_name": "Dr. Jane Pharmacist",  # Required for facility/hospital
        "state_license_number": "OH-HOSP-5001",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Tier 1 hospital with clean compliance record.",
    }

    resp = client.post("/csf/facility/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Should be submitted successfully
    assert data["status"] == "submitted"
    assert data["decision_status"] == "ok_to_ship"
    assert data["submission_id"]
    assert data["trace_id"]
    
    # Verify stored submission
    store = get_submission_store()
    submission = store.get_submission(data["submission_id"])
    assert submission is not None
    
    # REGRESSION: Verify payload.form has actual data
    assert submission.payload["form"]["facility_name"] == "Memorial Hospital"
    assert submission.payload["form"]["dea_number"] == "FM1234567"
    assert submission.payload["form"]["pharmacy_license_number"] == "OH-PHARM-12345"
    assert submission.payload["form"]["attestation_accepted"] is True
    
    # REGRESSION: Verify payload.decision.trace_id is populated
    assert submission.payload["decision"]["trace_id"] == data["trace_id"]
    
    # REGRESSION: Verify decision status is ok_to_ship
    assert submission.payload["decision"]["status"] == "ok_to_ship"


def test_facility_submit_blocked_path():
    """
    Verify facility blocked submissions correctly show blocked status.
    """
    payload = {
        "facility_name": "",  # Missing required field → should block
        "facility_type": "hospital",
        "account_number": "ACCT-88888",
        "dea_number": "FT1234567",
        "state_license_number": "",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "",
    }

    resp = client.post("/csf/facility/submit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    
    # Should be submitted but blocked
    assert data["status"] == "submitted"
    assert data["decision_status"] == "blocked"
    
    # Verify stored submission
    store = get_submission_store()
    submission = store.get_submission(data["submission_id"])
    assert submission is not None
    
    # Verify payload.decision.trace_id is populated
    assert submission.payload["decision"]["trace_id"] == data["trace_id"]
    
    # Verify decision status
    assert submission.payload["decision"]["status"] == "blocked"


def test_practitioner_submit_preserves_trace_id_from_evaluate():
    """
    Verify that if frontend sends trace_id from evaluate, it's preserved in submit.
    """
    # First evaluate to get trace_id
    eval_payload = {
        "facility_name": "Test Practice",
        "facility_type": "dental_practice",
        "account_number": "ACC-123",
        "practitioner_name": "Dr. Test",
        "state_license_number": "ST-12345",
        "dea_number": "DEA-1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    }
    
    eval_resp = client.post("/csf/practitioner/evaluate", json=eval_payload)
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    eval_trace_id = eval_data["trace_id"]
    
    # Now submit with same trace_id
    submit_payload = {**eval_payload, "trace_id": eval_trace_id}
    submit_resp = client.post("/csf/practitioner/submit", json=submit_payload)
    assert submit_resp.status_code == 200
    submit_data = submit_resp.json()
    
    # Should preserve trace_id from evaluate
    assert submit_data["trace_id"] == eval_trace_id
    
    # Verify stored submission has matching trace_id
    store = get_submission_store()
    submission = store.get_submission(submit_data["submission_id"])
    assert submission.trace_id == eval_trace_id
    assert submission.payload["decision"]["trace_id"] == eval_trace_id
