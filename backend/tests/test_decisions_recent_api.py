from datetime import datetime

from conftest import client
from src.autocomply.audit.decision_log import get_decision_log
from src.api.models.decision import DecisionOutcome, DecisionStatus


def _seed_trace(trace_id: str, engine_family: str, status: DecisionStatus) -> None:
    log = get_decision_log()
    decision = DecisionOutcome(
        status=status,
        reason=f"{engine_family} decision for {trace_id}",
        risk_level="low",
        trace_id=trace_id,
    )
    log.record(
        trace_id=trace_id,
        engine_family=engine_family,
        decision_type=f"{engine_family}_test",
        decision=decision,
    )


def test_decisions_recent_returns_traces_in_descending_order() -> None:
    log = get_decision_log()
    log.clear()

    _seed_trace("trace-1", "csf", DecisionStatus.OK_TO_SHIP)
    _seed_trace("trace-2", "license", DecisionStatus.NEEDS_REVIEW)
    _seed_trace("trace-3", "order", DecisionStatus.BLOCKED)

    resp = client.get("/decisions/recent?limit=2")
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2

    timestamps = [
        datetime.fromisoformat(item["last_updated"].replace("Z", "+00:00"))
        for item in data
    ]
    assert timestamps == sorted(timestamps, reverse=True)

    for item in data[:2]:
        assert "trace_id" in item
        assert "last_updated" in item
        assert "last_status" in item
        assert "engine_families" in item
        assert isinstance(item["engine_families"], list)


def test_decisions_recent_respects_limit() -> None:
    log = get_decision_log()
    log.clear()

    _seed_trace("trace-limit-1", "csf", DecisionStatus.OK_TO_SHIP)
    _seed_trace("trace-limit-2", "license", DecisionStatus.OK_TO_SHIP)
    _seed_trace("trace-limit-3", "order", DecisionStatus.OK_TO_SHIP)

    resp = client.get("/decisions/recent?limit=1")
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 1
