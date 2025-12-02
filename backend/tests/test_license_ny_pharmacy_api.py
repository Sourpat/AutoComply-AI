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
        "internal_notes": "Happy path NY Pharmacy license test.",
    }


def make_ny_pharmacy_payload_incomplete() -> dict:
    # Missing / wrong fields on purpose
    return {
        "pharmacy_name": "Manhattan Pharmacy",
        "account_number": "900123456",
        "ship_to_state": "NJ",  # not NY
        "dea_number": "FG1234567",
        "ny_state_license_number": "",
        "attestation_accepted": False,
        "internal_notes": "Negative NY Pharmacy license test.",
    }


def test_ny_pharmacy_evaluate_happy_path_ok_to_ship() -> None:
    payload = make_ny_pharmacy_payload_valid()

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []
    assert "reason" in data


def test_ny_pharmacy_evaluate_incomplete_needs_review() -> None:
    payload = make_ny_pharmacy_payload_incomplete()

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] in {"needs_review", "blocked"}
    assert data["status"] != "ok_to_ship"
    assert isinstance(data.get("missing_fields", []), list)
    assert len(data["missing_fields"]) >= 1


def test_ny_pharmacy_form_copilot_contract_shape() -> None:
    """
    Contract-level test: ensure the NY Pharmacy copilot returns
    the same shape as other license copilots.
    """
    payload = make_ny_pharmacy_payload_valid()

    resp = client.post("/license/ny-pharmacy/form-copilot", json=payload)
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
