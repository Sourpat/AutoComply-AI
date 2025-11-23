from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_controlled_substances_search_returns_default_items():
    resp = client.get("/controlled-substances/search")
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) >= 1
    # Each item should have at least an id and a name
    assert "id" in data[0]
    assert "name" in data[0]


def test_controlled_substances_search_filters_by_name():
    resp = client.get("/controlled-substances/search", params={"q": "Oxycodone"})
    assert resp.status_code == 200

    data = resp.json()
    assert any("Oxycodone" in item["name"] for item in data)


def test_controlled_substances_search_filters_by_ndc():
    # Using one of the mock NDCs:
    resp = client.get("/controlled-substances/search", params={"q": "12345-6789-01"})
    assert resp.status_code == 200

    data = resp.json()
    assert any(item["ndc"] == "12345-6789-01" for item in data)


def test_controlled_substances_history_requires_account_number():
    resp = client.get("/controlled-substances/history")
    assert resp.status_code == 422  # missing required query param


def test_controlled_substances_history_returns_items_for_account():
    resp = client.get(
        "/controlled-substances/history",
        params={"account_number": "ACC-123"},
    )
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) >= 1
    assert "id" in data[0]
    assert "name" in data[0]
