from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_rag_debug_endpoint_shape_and_jurisdictions():
    """
    The debug endpoint should:
    - exist and return HTTP 200
    - return a payload with `raw_retrieval` and `normalized_context` lists
    - include at least one normalized item with jurisdiction US-CA
      for a CA + GeneralMedicalUse scenario (matches our stubbed retriever).
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
        "/api/v1/licenses/debug/regulatory-context",
        json=payload,
    )

    assert response.status_code == 200

    data = response.json()
    assert data.get("success") is True

    raw_hits = data.get("raw_retrieval")
    normalized = data.get("normalized_context")

    assert isinstance(raw_hits, list)
    assert isinstance(normalized, list)
    assert raw_hits, "raw_retrieval should not be empty for CA test scenario"
    assert normalized, "normalized_context should not be empty for CA test scenario"

    jurisdictions = {item.get("jurisdiction") for item in normalized if isinstance(item, dict)}
    assert "US-CA" in jurisdictions
