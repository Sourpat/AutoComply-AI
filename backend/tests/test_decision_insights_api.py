from fastapi.testclient import TestClient

from src.api.main import app
from src.api.models.decision import DecisionOutcome, DecisionStatus
from src.autocomply.audit.decision_log import get_decision_log


client = TestClient(app)


def _seed_trace(trace_id: str) -> None:
    log = get_decision_log()
    log.clear()

    decision_ok = DecisionOutcome(
        status=DecisionStatus.OK_TO_SHIP,
        reason="CSF ok",
        risk_level="low",
        trace_id=trace_id,
    )
    decision_block = DecisionOutcome(
        status=DecisionStatus.BLOCKED,
        reason="Expired license",
        risk_level="high",
        trace_id=trace_id,
    )

    log.record(
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_hospital",
        decision=decision_ok,
    )
    log.record(
        trace_id=trace_id,
        engine_family="license",
        decision_type="license_ohio_tddd",
        decision=decision_block,
    )


def test_decision_insights_returns_summary_for_existing_trace() -> None:
    trace_id = "test-insights-trace"
    _seed_trace(trace_id)

    resp = client.get(f"/ai/decisions/insights/{trace_id}")
    assert resp.status_code == 200

    data = resp.json()
    assert data["trace_id"] == trace_id
    assert data["overall_status"] == "blocked"
    assert data["overall_risk"] in {"high", "mixed"}

    assert "summary" in data and data["summary"]
    assert "recommendations" in data and isinstance(data["recommendations"], list)
    assert any("expired" in r.lower() or "license" in r.lower() for r in data["recommendations"])


def test_decision_insights_404_for_unknown_trace() -> None:
    log = get_decision_log()
    log.clear()

    resp = client.get("/ai/decisions/insights/does-not-exist")
    assert resp.status_code == 404
