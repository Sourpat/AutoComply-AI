from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_validate_license_json_minimal_payload():
    """
    Basic integration-style test to ensure the JSON license validation
    endpoint is wired correctly and returns the expected response shape.

    NOTE:
    - This is intentionally simple and does not assert on specific
    - business rules yet.
    - It guards against route renames, model import errors, etc.
    """

    payload = {
        # Adjust these fields to match LicenseValidationRequest model
        "practice_type": "Standard",
        "state": "CA",
        "state_permit": "C987654",
        "state_expiry": "2028-08-15",
        "purchase_intent": "GeneralMedicalUse",
        "quantity": 10,
    }

    # Adjust URL if your route path is different
    response = client.post("/api/v1/licenses/validate/license", json=payload)

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, dict)
    assert "success" in data
    assert "verdict" in data

    verdict = data["verdict"]
    assert isinstance(verdict, dict)
    # These keys may vary depending on your current model, but we expect
    # at least some core fields to be present:
    # e.g., "allow_checkout", "reason" etc.
    assert "allow_checkout" in verdict
