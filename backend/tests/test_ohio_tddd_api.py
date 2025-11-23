from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_ohio_tddd_evaluate_valid_in_state_approved():
    payload = {
        "business_name": "Example Dental Clinic",
        "license_type": "clinic",
        "license_number": "TDDD-123456",
        "ship_to_state": "OH",
    }

    resp = client.post("/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "approved"
    assert "in-state" in data["reason"].lower()
    assert data["regulatory_references"] == ["ohio_tddd_registration"]


def test_ohio_tddd_evaluate_out_of_state_manual_review():
    payload = {
        "business_name": "Example Dental Clinic",
        "license_type": "clinic",
        "license_number": "TDDD-123456",
        "ship_to_state": "PA",
    }

    resp = client.post("/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "manual_review"
    assert "ship-to state" in data["reason"].lower()
    assert data["regulatory_references"] == ["ohio_tddd_registration"]


def test_ohio_tddd_evaluate_missing_fields_blocked():
    payload = {
        "business_name": "",  # missing
        "license_type": "",  # missing
        "license_number": "TDDD-123456",
        "ship_to_state": "OH",
    }

    resp = client.post("/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
    assert "business_name" in data["missing_fields"]
    assert "license_type" in data["missing_fields"]
    assert data["regulatory_references"] == ["ohio_tddd_registration"]
