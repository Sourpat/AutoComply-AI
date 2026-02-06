import datetime

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def _parse_iso(ts: str) -> datetime.datetime:
    return datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))


def test_action_updates_status_and_event() -> None:
    client.post("/api/ops/seed-verifier-cases")

    action_response = client.post(
        "/api/verifier/cases/case-001/actions",
        json={"action": "approve", "actor": "qa", "reason": "looks good"},
    )
    assert action_response.status_code == 200
    payload = action_response.json()
    assert payload["case"]["status"] == "approved"
    assert payload["event"]["event_type"] == "action"

    detail = client.get("/api/verifier/cases/case-001")
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert detail_payload["case"]["status"] == "approved"
    assert detail_payload["events"][0]["event_type"] == "action"


def test_add_note_and_events() -> None:
    client.post("/api/ops/seed-verifier-cases")

    note_response = client.post(
        "/api/verifier/cases/case-002/notes",
        json={"note": "Verifier note entry", "actor": "qa"},
    )
    assert note_response.status_code == 200
    note_payload = note_response.json()
    assert note_payload["note"]["note"] == "Verifier note entry"
    assert note_payload["event"]["event_type"] == "note"

    notes = client.get("/api/verifier/cases/case-002/notes")
    assert notes.status_code == 200
    notes_payload = notes.json()
    assert notes_payload[0]["note"] == "Verifier note entry"

    events = client.get("/api/verifier/cases/case-002/events")
    assert events.status_code == 200
    events_payload = events.json()
    assert events_payload[0]["event_type"] == "note"
    assert _parse_iso(events_payload[0]["created_at"]) >= _parse_iso(events_payload[-1]["created_at"])


def test_invalid_action_returns_400() -> None:
    client.post("/api/ops/seed-verifier-cases")

    response = client.post(
        "/api/verifier/cases/case-003/actions",
        json={"action": "invalid"},
    )
    assert response.status_code == 400
