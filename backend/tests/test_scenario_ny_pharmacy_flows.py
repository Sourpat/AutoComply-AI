from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.scenario_builders import (
    make_ny_pharmacy_license_payload_expired,
    make_ny_pharmacy_license_payload_happy,
    make_ny_pharmacy_license_payload_wrong_state,
)

client = TestClient(app)


def test_ny_pharmacy_happy_path() -> None:
    payload = make_ny_pharmacy_license_payload_happy()

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data.get("decision", data)

    assert decision["status"] == "ok_to_ship"
    assert decision.get("risk_level") == "low"
    assert isinstance(decision.get("risk_score"), (int, float))
    assert "reason" in decision

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    assert refs
    ids = {ref["id"] for ref in refs}
    assert "ny-pharmacy-core" in ids


def test_ny_pharmacy_expired_license_blocks() -> None:
    payload = make_ny_pharmacy_license_payload_expired()

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data.get("decision", data)

    assert decision["status"] == "blocked"
    assert decision.get("risk_level") == "high"
    assert isinstance(decision.get("risk_score"), (int, float))

    assert "expired" in decision["reason"].lower()

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    assert refs
    ids = {ref["id"] for ref in refs}
    assert "ny-pharmacy-core" in ids


def test_ny_pharmacy_wrong_state_needs_review() -> None:
    payload = make_ny_pharmacy_license_payload_wrong_state()

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data.get("decision", data)

    assert decision["status"] == "needs_review"
    assert decision.get("risk_level") == "medium"
    assert isinstance(decision.get("risk_score"), (int, float))

    assert "state" in decision["reason"].lower()

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    assert refs
