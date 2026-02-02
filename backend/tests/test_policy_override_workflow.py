from starlette.testclient import TestClient

from src.api.main import app
from src.api.models.decision import DecisionOutcome, DecisionStatus
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.submissions_store import get_submission_store
from src.core.db import execute_sql

client = TestClient(app)


def _create_submission(trace_id: str) -> str:
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="practitioner",
        tenant="demo-tenant",
        title="Override Test",
        subtitle="Policy override test",
        trace_id=trace_id,
        payload={},
        decision_status="ok_to_ship",
        risk_level="low",
    )
    return submission.submission_id


def test_policy_override_persists_and_updates_audit() -> None:
    trace_id = "trace-policy-override-001"
    submission_id = _create_submission(trace_id)

    decision_log = get_decision_log()
    decision_log.clear()

    decision_log.record(
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_practitioner",
        decision=DecisionOutcome(
            status=DecisionStatus.OK_TO_SHIP,
            reason="Initial decision",
            trace_id=trace_id,
        ),
    )

    response = client.post(
        f"/api/agentic/cases/{submission_id}/policy-override",
        json={
            "action": "block",
            "rationale": "Manual override for test",
            "reviewer": "tester@example.com",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    override = payload.get("override")
    assert override
    assert override["trace_id"] == trace_id
    assert override["submission_id"] == submission_id
    assert override["override_action"] == "block"

    rows = execute_sql(
        "SELECT * FROM policy_overrides WHERE id = :id",
        {"id": override["id"]},
    )
    assert rows

    audit_resp = client.get(f"/decisions/trace/{trace_id}")
    assert audit_resp.status_code == 200
    entries = audit_resp.json()
    assert entries
    last_entry = entries[-1]
    assert last_entry["event_type"] == "policy_override_applied"
    assert last_entry["status"] == "blocked"
    assert last_entry["override"]["reviewer"] == "tester@example.com"
    assert last_entry["override"]["rationale"] == "Manual override for test"
    assert last_entry["override"]["before_status"] == "ok_to_ship"
    assert last_entry["override"]["after_status"] == "blocked"
