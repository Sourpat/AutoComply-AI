from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_item_history_search_by_item_id():
    resp = client.get(
        "/controlled-substances/item-history/search",
        params={"query": "NDC-55555", "limit": 5},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    first = data[0]
    assert first["item_id"].startswith("NDC-55555")
    assert "dea_schedule" in first
    assert "source_documents" in first
    assert any("Controlled_Substances_Form_Flow_Updated.png" in d for d in first["source_documents"])


def test_item_history_search_by_name():
    resp = client.get(
        "/controlled-substances/item-history/search",
        params={"query": "hydrocodone", "limit": 5},
    )
    assert resp.status_code == 200
    data = resp.json()
    # Should find the Hydrocodone/APAP test item
    assert any("Hydrocodone" in item["name"] for item in data)


def test_item_history_search_empty_query_returns_422():
    resp = client.get("/controlled-substances/item-history/search", params={"query": ""})
    assert resp.status_code == 422
