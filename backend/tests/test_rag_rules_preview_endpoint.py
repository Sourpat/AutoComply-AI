from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_rules_context_preview_for_ca_general_medical_use():
    """
    For the CA + GeneralMedicalUse combination, our stubbed
    RAG pipeline should return at least one snippet, and at
    least one jurisdiction should be US-CA (state-level).
    """
    response = client.get(
        "/api/v1/licenses/rules/context",
        params={
            "state": "CA",
            "purchase_intent": "GeneralMedicalUse",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True

    items = data.get("items")
    assert isinstance(items, list)
    assert items  # should not be empty

    jurisdictions = {item.get("jurisdiction") for item in items if isinstance(item, dict)}
    assert "US-CA" in jurisdictions
