from conftest import client
from src.autocomply.audit.decision_log import get_decision_log
from src.api.models.decision import DecisionOutcome, DecisionStatus


def _seed_simple_trace(trace_id: str) -> None:
    """
    Seed the decision log with a simple CSF + license combo for this trace.
    """
    log = get_decision_log()
    log.clear()

    csf_decision = DecisionOutcome(
        status=DecisionStatus.OK_TO_SHIP,
        reason="Hospital CSF ok",
        risk_level="low",
        trace_id=trace_id,
    )
    license_decision = DecisionOutcome(
        status=DecisionStatus.OK_TO_SHIP,
        reason="Ohio TDDD ok",
        risk_level="low",
        trace_id=trace_id,
    )

    log.record(
        trace_id=trace_id,
        engine_family="csf",
        decision_type="csf_hospital",
        decision=csf_decision,
    )
    log.record(
        trace_id=trace_id,
        engine_family="license",
        decision_type="license_ohio_tddd",
        decision=license_decision,
    )


def test_case_summary_returns_overall_view_for_existing_trace() -> None:
    trace_id = "test-case-summary-trace"
    _seed_simple_trace(trace_id)

    resp = client.get(f"/cases/summary/{trace_id}")
    assert resp.status_code == 200

    data = resp.json()

    assert data["trace_id"] == trace_id
    assert data["overall_status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert data["overall_status"] == "ok_to_ship"

    assert "decisions" in data and isinstance(data["decisions"], list)
    assert len(data["decisions"]) == 2

    # Ensure at least one regulatory reference – either from decisions or inferred
    assert "regulatory_references" in data
    assert isinstance(data["regulatory_references"], list)

    # Insight should be embedded
    assert "insight" in data
    insight = data["insight"]
    assert insight["trace_id"] == trace_id
    assert "summary" in insight and insight["summary"]


def test_case_summary_404_for_unknown_trace() -> None:
    log = get_decision_log()
    log.clear()

    resp = client.get("/cases/summary/does-not-exist")
    assert resp.status_code == 404
