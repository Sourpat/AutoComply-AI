import json
import os
from pathlib import Path

from tests.conftest import client


def test_submission_events_feed(tmp_path) -> None:
    os.environ["ENV"] = "ci"
    outbox = Path(".data") / "email_outbox.jsonl"
    if outbox.exists():
        outbox.unlink()

    submit_resp = client.post(
        "/api/submitter/submissions",
        json={
            "client_token": "events-feed-1",
            "subject": "Events Feed",
            "submitter_name": "Event Tester",
            "jurisdiction": "OH",
            "doc_type": "csf_facility",
            "notes": "events",
        },
    )
    assert submit_resp.status_code == 200
    submission_id = submit_resp.json()["submission_id"]
    case_id = submit_resp.json()["verifier_case_id"]

    client.get(f"/api/verifier/cases/{case_id}")

    request_resp = client.post(
        f"/api/verifier/cases/{case_id}/decision",
        json={"type": "request_info", "reason": "Need docs", "actor": "verifier"},
    )
    assert request_resp.status_code == 200

    respond_resp = client.post(
        f"/api/submitter/submissions/{submission_id}/respond",
        json={"message": "Here you go"},
    )
    assert respond_resp.status_code == 200

    upload_resp = client.post(
        f"/api/submissions/{submission_id}/attachments",
        files={"file": ("extra.txt", b"extra", "text/plain")},
    )
    assert upload_resp.status_code == 200

    approve_resp = client.post(
        f"/api/verifier/cases/{case_id}/decision",
        json={"type": "approve", "actor": "verifier"},
    )
    assert approve_resp.status_code == 200

    events_resp = client.get(f"/api/submitter/submissions/{submission_id}/events?limit=50")
    assert events_resp.status_code == 200
    events = events_resp.json()
    event_types = [event.get("event_type") for event in events]
    assert "submission_created" in event_types
    assert "verifier_opened" in event_types
    assert "verifier_requested_info" in event_types
    assert "submitter_responded" in event_types
    assert "submitter_uploaded_attachment" in event_types
    assert "verifier_approved" in event_types

    limited_resp = client.get(f"/api/submitter/submissions/{submission_id}/events?limit=2")
    assert limited_resp.status_code == 200
    assert len(limited_resp.json()) == 2

    assert outbox.exists()
    lines = outbox.read_text(encoding="utf-8").splitlines()
    payloads = [json.loads(line) for line in lines]
    outbox_types = {entry.get("event", {}).get("event_type") for entry in payloads}
    assert "verifier_requested_info" in outbox_types
    assert "verifier_approved" in outbox_types
