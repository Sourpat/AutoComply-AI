from datetime import datetime, timedelta, timezone

from starlette.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.submissions_store import get_submission_store

client = TestClient(app)


def _create_submission(trace_id: str) -> str:
    store = get_submission_store()
    submission = store.create_submission(
        csf_type="practitioner",
        tenant="demo-tenant",
        title="Metrics Test",
        subtitle="Override metrics",
        trace_id=trace_id,
        payload={},
        decision_status="ok_to_ship",
        risk_level="low",
    )
    return submission.submission_id


def test_override_metrics_shape() -> None:
    submission_id = _create_submission("trace-metrics-001")
    response = client.post(
        f"/api/agentic/cases/{submission_id}/policy-override",
        json={
            "action": "require_review",
            "rationale": "Override requested for metrics coverage",
            "reviewer": "verifier@example.com",
        },
        headers={"X-AutoComply-Role": "verifier"},
    )
    assert response.status_code == 200

    metrics = client.get("/api/console/override-metrics?window=24h")
    assert metrics.status_code == 200
    payload = metrics.json()
    assert "total" in payload
    assert "by_action" in payload
    assert "by_reviewer" in payload
    assert "recent" in payload
    assert isinstance(payload["recent"], list)
