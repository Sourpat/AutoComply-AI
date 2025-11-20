from datetime import date, timedelta

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def _base_payload():
    """
    Helper to construct a minimal valid payload for the JSON
    license validation endpoint. Field names should match
    LicenseValidationRequest and existing tests.
    """
    return {
        "practice_type": "Standard",
        "state": "CA",
        "state_permit": "C987654",
        "purchase_intent": "GeneralMedicalUse",
        "quantity": 10,
    }


def test_expired_license_blocks_checkout():
    today = date.today()
    expired_date = today - timedelta(days=1)

    payload = _base_payload()
    payload["state_expiry"] = expired_date.isoformat()

    response = client.post("/api/v1/licenses/validate/license", json=payload)
    assert response.status_code == 200

    data = response.json()
    verdict = data.get("verdict", {})

    # Expired license should not be allowed for checkout
    assert verdict.get("allow_checkout") is False


def test_near_expiry_license_allows_checkout():
    today = date.today()
    near_date = today + timedelta(days=7)

    payload = _base_payload()
    payload["state_expiry"] = near_date.isoformat()

    response = client.post("/api/v1/licenses/validate/license", json=payload)
    assert response.status_code == 200

    data = response.json()
    verdict = data.get("verdict", {})

    # Near expiry is still allowed, business logic handled by evaluate_expiry
    assert verdict.get("allow_checkout") is True


def test_active_license_allows_checkout():
    today = date.today()
    active_date = today + timedelta(days=90)

    payload = _base_payload()
    payload["state_expiry"] = active_date.isoformat()

    response = client.post("/api/v1/licenses/validate/license", json=payload)
    assert response.status_code == 200

    data = response.json()
    verdict = data.get("verdict", {})

    # Clearly active license should be allowed
    assert verdict.get("allow_checkout") is True
