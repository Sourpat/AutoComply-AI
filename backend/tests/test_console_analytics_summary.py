from starlette.testclient import TestClient

from src.api.main import app


client = TestClient(app)


def test_console_analytics_summary_payload() -> None:
    response = client.get("/api/console/analytics/summary?days=30")
    assert response.status_code == 200
    payload = response.json()

    assert "total_cases" in payload
    assert "open_cases" in payload
    assert "closed_cases" in payload
    assert "overdue_cases" in payload
    assert "due_24h" in payload
    assert "status_breakdown" in payload
    assert "decision_type_breakdown" in payload
    assert "cases_created_daily" in payload
    assert "cases_closed_daily" in payload
    assert "top_event_types" in payload
    assert "verifier_activity" in payload
    assert "top_evidence_tags" in payload
    assert "request_info_reasons" in payload
