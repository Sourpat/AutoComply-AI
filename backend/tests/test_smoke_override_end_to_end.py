from starlette.testclient import TestClient

from src.api.main import app
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.submissions_store import get_submission_store


client = TestClient(app)


def _create_submission(trace_id: str) -> str:
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="practitioner",
        tenant="demo-tenant",
        title="Smoke Override Case",
        subtitle="Smoke test submission",
        trace_id=trace_id,
        payload={"source": "smoke-test"},
        decision_status="ok_to_ship",
        risk_level="low",
    )
    return submission.submission_id


def test_smoke_override_end_to_end() -> None:
    trace_id = "trace-smoke-override-001"
    submission_id = _create_submission(trace_id)

    decision_log = get_decision_log()
    decision_log.clear()

    case_response = client.post(
        "/api/workflow/cases",
        json={
            "decisionType": "csf_practitioner",
            "title": "Smoke Override Case",
            "summary": "Created for override smoke test",
            "submissionId": submission_id,
        },
    )
    assert case_response.status_code == 201

    list_response = client.get("/api/workflow/cases?limit=50")
    assert list_response.status_code == 200
    items = list_response.json().get("items", [])
    assert any(
        (item.get("submission_id") or item.get("submissionId")) == submission_id
        for item in items
    )

    override_response = client.post(
        f"/api/agentic/cases/{submission_id}/policy-override",
        json={
            "action": "block",
            "rationale": "Manual override rationale for smoke test",
            "reviewer": "smoke.tester@example.com",
        },
        headers={"X-AutoComply-Role": "verifier"},
    )
    assert override_response.status_code == 200

    trace_response = client.get(f"/decisions/trace/{trace_id}")
    assert trace_response.status_code == 200
    entries = trace_response.json()
    assert entries
    last_entry = entries[-1]
    assert last_entry["event_type"] == "policy_override_applied"
    assert last_entry["override"]["submission_id"] == submission_id
