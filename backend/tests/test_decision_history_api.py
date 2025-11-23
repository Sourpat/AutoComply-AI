from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_decision_history_roundtrip():
    snapshot = {
        "engine_family": "pdma",
        "decision_type": "pdma_sample",
        "status": "ineligible",
        "jurisdiction": "FL",
        "regulatory_reference_ids": ["pdma_sample_eligibility"],
        "source_documents": ["/mnt/data/FLORIDA TEST.pdf"],
        "payload": {"foo": "bar"},
    }

    resp = client.post("/decisions/history", json=snapshot)
    assert resp.status_code == 200
    body = resp.json()

    assert body["engine_family"] == "pdma"
    assert body["status"] == "ineligible"
    assert body["source_documents"] == ["/mnt/data/FLORIDA TEST.pdf"]
    assert "id" in body
    assert "timestamp" in body

    resp2 = client.get("/decisions/history?limit=10")
    assert resp2.status_code == 200
    records = resp2.json()
    assert len(records) >= 1
    assert records[0]["id"] == body["id"]
