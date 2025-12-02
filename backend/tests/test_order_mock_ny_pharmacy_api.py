from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def make_ny_pharmacy_payload_valid() -> dict:
    return {
        "pharmacy_name": "Manhattan Pharmacy",
        "account_number": "900123456",
        "ship_to_state": "NY",
        "dea_number": "FG1234567",
        "ny_state_license_number": "NYPHARM-001234",
        "attestation_accepted": True,
        "internal_notes": "NY Pharmacy mock order – happy path.",
    }


def make_ny_pharmacy_payload_invalid() -> dict:
    return {
        "pharmacy_name": "Manhattan Pharmacy",
        "account_number": "900123456",
        "ship_to_state": "NJ",  # wrong state on purpose
        "dea_number": "FG1234567",
        "ny_state_license_number": "",
        "attestation_accepted": False,
        "internal_notes": "NY Pharmacy mock order – negative path.",
    }


def test_ny_pharmacy_order_mock_happy_path_ok_to_ship() -> None:
    payload = {"ny_pharmacy": make_ny_pharmacy_payload_valid()}

    resp = client.post("/orders/mock/ny-pharmacy-approval", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    for key in ["license_status", "license_reason", "license_missing_fields", "final_decision", "notes"]:
        assert key in data

    assert data["license_status"] == "ok_to_ship"
    assert data["final_decision"] == "ok_to_ship"
    assert data["license_missing_fields"] == []
    assert isinstance(data["notes"], list)
    assert any("NY Pharmacy license decision" in n for n in data["notes"])


def test_ny_pharmacy_order_mock_negative_path_not_ok_to_ship() -> None:
    payload = {"ny_pharmacy": make_ny_pharmacy_payload_invalid()}

    resp = client.post("/orders/mock/ny-pharmacy-approval", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["license_status"] in {"needs_review", "blocked"}
    assert data["final_decision"] in {"needs_review", "blocked"}
    assert data["final_decision"] != "ok_to_ship"
    assert isinstance(data.get("license_missing_fields", []), list)
    assert isinstance(data.get("notes", []), list)
