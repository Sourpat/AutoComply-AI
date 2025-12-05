from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_ny_pharmacy_order_mock_happy_path_ok_to_ship() -> None:
    resp = client.get("/orders/mock/ny-pharmacy-approval")
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]
    assert decision["status"] == "ok_to_ship"
    assert decision["risk_level"] == "low"
    assert data["final_decision"] == "ok_to_ship"
    assert data["license_status"] == "ok_to_ship"


def test_ny_pharmacy_order_mock_expired_license_blocked() -> None:
    resp = client.get("/orders/mock/ny-pharmacy-expired-license")
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]
    assert decision["status"] == "blocked"
    assert decision["risk_level"] == "high"
    assert "expired" in decision["reason"].lower()
    assert data["final_decision"] == "blocked"
    assert data["license_status"] == "blocked"


def test_ny_pharmacy_order_mock_wrong_state_needs_review() -> None:
    resp = client.get("/orders/mock/ny-pharmacy-wrong-state")
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]
    assert decision["status"] == "needs_review"
    assert decision["risk_level"] == "medium"
    assert "state" in decision["reason"].lower()
    assert data["final_decision"] == "needs_review"
    assert data["license_status"] == "needs_review"
