from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_decision_packet_basic() -> None:
    client.post("/api/ops/seed-verifier-cases")

    packet_resp = client.get("/api/verifier/cases/case-001/packet")
    assert packet_resp.status_code == 200
    payload = packet_resp.json()
    assert payload["packet_version"] == "dp-v1"
    assert payload["case"]["case_id"] == "case-001"
    assert payload["explain"] is not None
    assert payload["explain"]["knowledge_version"]


def test_decision_packet_no_explain() -> None:
    client.post("/api/ops/seed-verifier-cases")

    packet_resp = client.get("/api/verifier/cases/case-002/packet?include_explain=0")
    assert packet_resp.status_code == 200
    payload = packet_resp.json()
    assert payload["explain"] is None


def test_decision_packet_includes_actions() -> None:
    client.post("/api/ops/seed-verifier-cases")

    client.post(
        "/api/verifier/cases/case-003/actions",
        json={"action": "approve", "actor": "tester"},
    )
    client.post(
        "/api/verifier/cases/case-003/notes",
        json={"note": "Packet note", "actor": "tester"},
    )

    packet_resp = client.get("/api/verifier/cases/case-003/packet?include_explain=0")
    assert packet_resp.status_code == 200
    payload = packet_resp.json()
    actions = payload["actions"]
    assert any(item["event_type"] == "action" for item in actions)
    assert any(item["event_type"] == "note" for item in actions)
