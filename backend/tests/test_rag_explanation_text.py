from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_explanation_includes_jurisdiction_from_context():
    """
    For a CA general medical use scenario, the engine should return:
    - HTTP 200
    - a non-empty `explanation` string
    - text that references the CA jurisdiction coming from regulatory_context
      (our stubbed retriever uses US-CA for this scenario).
    """
    payload = {
        "practice_type": "Standard",
        "state": "CA",
        "state_permit": "C987654",
        "state_expiry": "2028-08-15",
        "purchase_intent": "GeneralMedicalUse",
        "quantity": 10,
    }

    response = client.post(
        "/api/v1/licenses/validate/license",
        json=payload,
    )
    assert response.status_code == 200

    data = response.json()
    explanation = data.get("explanation")

    assert isinstance(explanation, str)
    assert explanation.strip() != ""

    # Our deterministic helper should mention jurisdictions from the
    # regulatory_context (which includes US-CA in the stub).
    assert "US-CA" in explanation
