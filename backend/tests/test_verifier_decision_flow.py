from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_decision_flow_approve_and_snapshot() -> None:
    client.post("/api/ops/seed-verifier-cases")

    decision = client.post(
        "/api/verifier/cases/case-001/decision?include_explain=0",
        json={"type": "approve", "reason": "ok", "actor": "qa"},
    )
    assert decision.status_code == 200
    payload = decision.json()
    assert payload["status"] == "approved"
    assert payload["locked"] is True
    assert payload["decision"]["type"] == "approve"

    final_packet = client.get("/api/verifier/cases/case-001/final-packet")
    assert final_packet.status_code == 200
    final_payload = final_packet.json()
    assert final_payload["finalization"]["is_final"] is True
    assert final_payload["finalization"]["decision"]["type"] == "approve"

    packet = client.get("/api/verifier/cases/case-001/packet?include_explain=0")
    assert packet.status_code == 200
    packet_payload = packet.json()
    assert packet_payload["finalization"]["is_final"] is True
    assert packet_payload["finalization"]["decision"]["type"] == "approve"


def test_decision_flow_reject_and_lock() -> None:
    client.post("/api/ops/seed-verifier-cases")

    decision = client.post(
        "/api/verifier/cases/case-002/decision?include_explain=0",
        json={"type": "reject", "reason": "missing docs", "actor": "qa"},
    )
    assert decision.status_code == 200
    payload = decision.json()
    assert payload["status"] == "rejected"
    assert payload["locked"] is True


def test_decision_flow_request_info_no_snapshot() -> None:
    client.post("/api/ops/seed-verifier-cases")

    decision = client.post(
        "/api/verifier/cases/case-003/decision?include_explain=0",
        json={"type": "request_info", "reason": "need more info", "actor": "qa"},
    )
    assert decision.status_code == 200
    payload = decision.json()
    assert payload["status"] == "needs_info"
    assert payload["locked"] is False

    final_packet = client.get("/api/verifier/cases/case-003/final-packet")
    assert final_packet.status_code == 404


def test_locked_cases_reject_mutations_and_bulk_skips() -> None:
    client.post("/api/ops/seed-verifier-cases")

    decision = client.post(
        "/api/verifier/cases/case-004/decision?include_explain=0",
        json={"type": "approve", "reason": "ok", "actor": "qa"},
    )
    assert decision.status_code == 200

    note_resp = client.post(
        "/api/verifier/cases/case-004/notes",
        json={"note": "should fail", "actor": "qa"},
    )
    assert note_resp.status_code == 409

    action_resp = client.post(
        "/api/verifier/cases/case-004/actions",
        json={"action": "needs_review", "actor": "qa"},
    )
    assert action_resp.status_code == 409

    bulk_resp = client.post(
        "/api/verifier/cases/bulk/actions",
        json={"case_ids": ["case-004", "case-005"], "action": "needs_review"},
    )
    assert bulk_resp.status_code == 200
    payload = bulk_resp.json()
    assert payload["updated_count"] == 1
    assert any(item["case_id"] == "case-004" for item in payload["failures"])
