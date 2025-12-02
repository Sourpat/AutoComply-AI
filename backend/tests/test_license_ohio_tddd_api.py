from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def make_valid_ohio_tddd_payload() -> dict:
    return {
        "tddd_number": "01234567",
        "facility_name": "Example Ohio Pharmacy",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Happy path Ohio TDDD test payload.",
    }


def test_ohio_tddd_evaluate_ok() -> None:
    payload = make_valid_ohio_tddd_payload()
    resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert "reason" in data
    assert "missing_fields" in data


def test_ohio_tddd_form_copilot_ok() -> None:
    payload = make_valid_ohio_tddd_payload()
    resp = client.post("/license/ohio-tddd/form-copilot", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "status" in data
    assert "reason" in data
    assert "missing_fields" in data
    assert "regulatory_references" in data
    assert "rag_explanation" in data
    assert "artifacts_used" in data
    assert "rag_sources" in data


def test_ohio_tddd_evaluate_missing_tddd_number() -> None:
    payload = make_valid_ohio_tddd_payload()
    payload["tddd_number"] = ""

    resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in {"needs_review", "blocked"}
