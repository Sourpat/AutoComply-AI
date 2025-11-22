from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_explain_rule_basic_shape():
    """
    Ensure the 'explain-rule' endpoint is wired correctly and returns
    a context list for a simple CA + GeneralMedicalUse scenario.
    """
    payload = {
        "state": "CA",
        "purchase_intent": "GeneralMedicalUse",
    }

    response = client.post("/api/v1/licenses/explain-rule", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data.get("state") == "CA"
    assert data.get("purchase_intent") == "GeneralMedicalUse"

    context = data.get("context")
    assert isinstance(context, list)
