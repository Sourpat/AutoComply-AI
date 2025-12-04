from fastapi.testclient import TestClient
import pytest

from src.api.main import app

client = TestClient(app)


@pytest.fixture()
def ohio_tddd_happy_payload() -> dict:
    return {
        "tddd_number": "01234567",
        "facility_name": "Example Ohio Pharmacy",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Happy path Ohio TDDD test payload.",
    }


def test_ohio_tddd_evaluate_ok_to_ship(ohio_tddd_happy_payload: dict) -> None:
    resp = client.post("/license/ohio-tddd/evaluate", json=ohio_tddd_happy_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["reason"] == "Ohio TDDD license details appear complete for this request."
    assert data["missing_fields"] == []

    decision = data["decision"]
    assert decision["status"] == "ok_to_ship"
    assert decision["reason"] == data["reason"]
    assert isinstance(decision["regulatory_references"], list)
    assert decision["regulatory_references"]
    ids = {ref["id"] for ref in decision["regulatory_references"]}
    assert "ohio-tddd-core" in ids


def test_ohio_tddd_evaluate_missing_tddd_number(ohio_tddd_happy_payload: dict) -> None:
    payload = {**ohio_tddd_happy_payload, "tddd_number": ""}

    resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "needs_review"
    assert "Missing required fields" in data["reason"]
    assert "tddd_number" in data["missing_fields"]
    decision = data["decision"]
    assert decision["status"] == "needs_review"
    assert isinstance(decision["regulatory_references"], list)


def test_ohio_tddd_evaluate_missing_required_field_returns_422(
    ohio_tddd_happy_payload: dict,
) -> None:
    payload = {**ohio_tddd_happy_payload}
    payload.pop("tddd_number")

    resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 422


def test_ohio_tddd_evaluate_attestation_not_accepted(
    ohio_tddd_happy_payload: dict,
) -> None:
    payload = {**ohio_tddd_happy_payload, "attestation_accepted": False}

    resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
    assert data["reason"] == "Attestation was not accepted."
    assert data["decision"]["status"] == "blocked"


def test_ohio_tddd_form_copilot_ok(ohio_tddd_happy_payload: dict) -> None:
    resp = client.post("/license/ohio-tddd/form-copilot", json=ohio_tddd_happy_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "status" in data
    assert "reason" in data
    assert "missing_fields" in data
    assert "regulatory_references" in data
    assert "rag_explanation" in data
    assert "artifacts_used" in data
    assert "rag_sources" in data
