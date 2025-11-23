from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_search_controlled_substances_by_name():
    resp = client.get("/controlled-substances/search", params={"q": "oxy"})
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    names = {item["name"].lower() for item in data}
    # We expect Oxycodone 5 mg tablet to show up in the stub catalog
    assert any("oxycodone" in name for name in names)


def test_search_controlled_substances_requires_min_length():
    resp = client.get("/controlled-substances/search", params={"q": "o"})
    assert resp.status_code == 422  # FastAPI validation on min_length


def test_history_for_known_account():
    resp = client.get(
        "/controlled-substances/history",
        params={"account_number": "ACC-123"},
    )
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    first = data[0]
    assert "id" in first
    assert "name" in first
    # Should include account_number + last_ordered_at in the history item
    assert first.get("account_number") == "ACC-123"
    assert "last_ordered_at" in first


def test_history_for_unknown_account_returns_empty_list():
    resp = client.get(
        "/controlled-substances/history",
        params={"account_number": "NON-EXISTENT-ACCOUNT"},
    )
    assert resp.status_code == 200
    assert resp.json() == []
