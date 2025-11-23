from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_verification_submit_and_queue():
    payload = {
        "engine_family": "pdma",
        "decision_type": "pdma_sample",
        "jurisdiction": "FL",
        "reason_for_review": "manual_review",
        "decision_snapshot_id": "snap-123",
        "regulatory_reference_ids": ["pdma_sample_eligibility"],
        "source_documents": ["/mnt/data/FLORIDA TEST.pdf"],
        "user_question": "Why is this blocked?",
        "channel": "web_sandbox",
        "payload": {"foo": "bar"},
    }

    resp = client.post("/verifications/submit", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["engine_family"] == "pdma"
    assert body["status"] == "pending"
    assert body["source_documents"] == ["/mnt/data/FLORIDA TEST.pdf"]
    assert "id" in body
    assert "created_at" in body

    resp2 = client.get("/verifications/queue?status=pending&limit=10")
    assert resp2.status_code == 200
    queue = resp2.json()
    assert any(req["id"] == body["id"] for req in queue)
