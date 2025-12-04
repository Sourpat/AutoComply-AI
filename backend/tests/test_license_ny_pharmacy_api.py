from fastapi.testclient import TestClient
import pytest

from src.api.main import app


client = TestClient(app)


@pytest.fixture()
def ny_pharmacy_happy_payload() -> dict:
    return {
        "pharmacy_name": "Manhattan Pharmacy",
        "account_number": "900123456",
        "ship_to_state": "NY",
        "dea_number": "FG1234567",
        "ny_state_license_number": "NYPHARM-001234",
        "attestation_accepted": True,
        "internal_notes": "Happy path NY Pharmacy license test.",
    }


@pytest.fixture()
def ny_pharmacy_incomplete_payload() -> dict:
    return {
        "pharmacy_name": "Manhattan Pharmacy",
        "account_number": "900123456",
        "ship_to_state": "NJ",
        "dea_number": "FG1234567",
        "ny_state_license_number": "",
        "attestation_accepted": False,
        "internal_notes": "Negative NY Pharmacy license test.",
    }


def test_ny_pharmacy_evaluate_happy_path_ok_to_ship(
    ny_pharmacy_happy_payload: dict,
) -> None:
    resp = client.post(
        "/license/ny-pharmacy/evaluate", json=ny_pharmacy_happy_payload
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []
    assert (
        data["reason"] == "NY Pharmacy license details appear complete for this request."
    )


def test_ny_pharmacy_evaluate_incomplete_needs_review(
    ny_pharmacy_incomplete_payload: dict,
) -> None:
    resp = client.post(
        "/license/ny-pharmacy/evaluate", json=ny_pharmacy_incomplete_payload
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "needs_review"
    assert len(data["missing_fields"]) >= 1
    assert "ny_state_license_number" in data["missing_fields"]
    assert "attestation_accepted" in data["missing_fields"]


def test_ny_pharmacy_evaluate_missing_license_number_raises_validation(
    ny_pharmacy_happy_payload: dict,
) -> None:
    payload = {**ny_pharmacy_happy_payload}
    payload.pop("ny_state_license_number")

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 422


def test_ny_pharmacy_form_copilot_contract_shape(
    ny_pharmacy_happy_payload: dict,
) -> None:
    """
    Contract-level test: ensure the NY Pharmacy copilot returns
    the same shape as other license copilots.
    """
    resp = client.post("/license/ny-pharmacy/form-copilot", json=ny_pharmacy_happy_payload)
    assert resp.status_code == 200

    data = resp.json()
    # These keys should match the shared copilot contract
    for key in [
        "status",
        "reason",
        "missing_fields",
        "regulatory_references",
        "rag_explanation",
        "artifacts_used",
        "rag_sources",
    ]:
        assert key in data
