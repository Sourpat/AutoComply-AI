from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def _base_payload():
    return {
        "practice_type": "Standard",
        "state": "CA",
        "state_permit": "C987654",
        "purchase_intent": "GeneralMedicalUse",
        "quantity": 10,
    }


def test_regulatory_context_includes_state_and_dea_snippets():
    payload = _base_payload()

    response = client.post("/api/v1/licenses/validate/license", json=payload)
    assert response.status_code == 200

    data = response.json()
    verdict = data.get("verdict", {})

    # New field added by RegulationRetriever wiring
    context = verdict.get("regulatory_context")
    assert isinstance(context, list)
    assert context  # should not be empty for CA

    # At least one snippet should be CA-specific, one DEA-level
    jurisdictions = {item.get("jurisdiction") for item in context}
    assert "US-CA" in jurisdictions
    assert "US-DEA" in jurisdictions
