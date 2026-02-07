import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from tests.conftest import client
from src.autocomply.domain import sla_policy
from src.autocomply.domain import notification_store
from src.autocomply.integrations import email_hooks


def test_sla_reminders(monkeypatch) -> None:
    os.environ["ENV"] = "ci"
    outbox = Path(".data") / "email_outbox.jsonl"
    if outbox.exists():
        outbox.unlink()

    base_time = datetime(2026, 2, 7, 0, 0, 0, tzinfo=timezone.utc)
    current_time = {"value": base_time}

    def _now() -> datetime:
        return current_time["value"]

    def _now_iso() -> str:
        return _now().isoformat().replace("+00:00", "Z")

    def _day_start_iso() -> str:
        now = _now().replace(hour=0, minute=0, second=0, microsecond=0)
        return now.isoformat().replace("+00:00", "Z")

    monkeypatch.setattr(sla_policy, "utc_now", _now)
    monkeypatch.setattr(sla_policy, "now_iso", _now_iso)
    monkeypatch.setattr(notification_store, "_now_iso", _now_iso)
    monkeypatch.setattr(notification_store, "_day_start_iso", _day_start_iso)
    monkeypatch.setattr(email_hooks, "_now_iso", _now_iso)

    submit_resp = client.post(
        "/api/submitter/submissions",
        json={
            "client_token": "sla-reminders-1",
            "subject": "SLA Reminders",
            "submitter_name": "SLA Tester",
            "jurisdiction": "OH",
            "doc_type": "csf_facility",
            "notes": "sla reminders",
        },
    )
    assert submit_resp.status_code == 200
    submission_id = submit_resp.json()["submission_id"]
    case_id = submit_resp.json()["verifier_case_id"]

    request_resp = client.post(
        f"/api/verifier/cases/{case_id}/decision",
        json={"type": "request_info", "reason": "Need docs", "actor": "verifier"},
    )
    assert request_resp.status_code == 200

    run_resp = client.post("/api/ops/sla/run")
    assert run_resp.status_code == 200
    assert run_resp.json()["emitted_count"] >= 1

    run_again_resp = client.post("/api/ops/sla/run")
    assert run_again_resp.status_code == 200
    assert run_again_resp.json()["emitted_count"] == 0

    events_resp = client.get(f"/api/submitter/submissions/{submission_id}/events?limit=50")
    assert events_resp.status_code == 200
    event_types = [event.get("event_type") for event in events_resp.json()]
    assert "sla_due_soon" in event_types

    current_time["value"] = base_time + timedelta(hours=5)
    overdue_resp = client.post("/api/ops/sla/run")
    assert overdue_resp.status_code == 200

    detail_resp = client.get(f"/api/submitter/submissions/{submission_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["sla_escalation_level"] == 1

    current_time["value"] = base_time + timedelta(hours=29)
    escalated_resp = client.post("/api/ops/sla/run")
    assert escalated_resp.status_code == 200

    detail_resp = client.get(f"/api/submitter/submissions/{submission_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["sla_escalation_level"] == 2

    current_time["value"] = base_time + timedelta(hours=121)
    escalated_resp = client.post("/api/ops/sla/run")
    assert escalated_resp.status_code == 200

    detail_resp = client.get(f"/api/submitter/submissions/{submission_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["sla_escalation_level"] == 3

    stats_resp = client.get("/api/ops/sla/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["needs_info_overdue"] == 1
    assert stats["decision_overdue"] == 1
    assert stats["verifier_overdue"] == 1

    assert outbox.exists()
    payloads = [json.loads(line) for line in outbox.read_text(encoding="utf-8").splitlines()]
    outbox_types = {entry.get("event", {}).get("event_type") for entry in payloads}
    assert "sla_overdue" in outbox_types
