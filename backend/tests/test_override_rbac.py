from starlette.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.submissions_store import get_submission_store

client = TestClient(app)


def _create_submission(trace_id: str) -> str:
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="practitioner",
        tenant="demo-tenant",
        title="RBAC Test",
        subtitle="Override RBAC",
        trace_id=trace_id,
        payload={},
        decision_status="ok_to_ship",
        risk_level="low",
    )
    return submission.submission_id


def test_override_rejects_unauthorized_role() -> None:
    submission_id = _create_submission("trace-rbac-001")
    response = client.post(
        f"/api/agentic/cases/{submission_id}/policy-override",
        json={
            "action": "approve",
            "rationale": "Override requested for test case",
            "reviewer": "submitter@example.com",
        },
        headers={"X-AutoComply-Role": "submitter"},
    )
    assert response.status_code == 403
