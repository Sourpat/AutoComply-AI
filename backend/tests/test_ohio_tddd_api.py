from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_ohio_tddd_evaluate_exempt_ok():
    payload = {
        "customer_response": "EXEMPT",
        "practitioner_name": "Test Practitioner",
        "state_board_license_number": "SB-123",
        "tddd_license_number": None,
        "dea_number": None,
        "tddd_license_category": None,
    }

    resp = client.post("/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []


def test_ohio_tddd_evaluate_subject_to_tddd_missing_fields_blocked():
    payload = {
        "customer_response": "LICENSED_OR_APPLYING",
        "practitioner_name": "Test Practitioner",
        "state_board_license_number": "SB-123",
        "tddd_license_number": "",
        "dea_number": None,
        "tddd_license_category": "",
    }

    resp = client.post("/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
    assert "tddd_license_number" in data["missing_fields"]
    assert "tddd_license_category" in data["missing_fields"]
