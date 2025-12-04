from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_regulatory_preview_by_doc_id_ohio_tddd() -> None:
    resp = client.post(
        "/rag/regulatory/preview",
        json={
            "doc_ids": ["ohio-tddd-core"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    assert "items" in data
    items = data["items"]
    assert isinstance(items, list)
    assert items

    first = items[0]
    assert first["id"] == "ohio-tddd-core"
    assert first["jurisdiction"] == "US-OH"
    assert "source" in first
    assert "label" in first


def test_regulatory_preview_by_decision_type_csf_hospital() -> None:
    resp = client.post(
        "/rag/regulatory/preview",
        json={
            "decision_type": "csf_hospital",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert items

    ids = {item["id"] for item in items}
    assert "csf_hospital_form" in ids


def test_regulatory_preview_empty_when_unknown_decision_type() -> None:
    resp = client.post(
        "/rag/regulatory/preview",
        json={
            "decision_type": "nonexistent_decision_type",
            "jurisdiction": "US-XX",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]

    # We don't raise errors for unknown mappings; we just return an empty list.
    assert isinstance(items, list)
    assert items == []
