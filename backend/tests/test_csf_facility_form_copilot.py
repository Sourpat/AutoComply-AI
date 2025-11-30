from starlette.testclient import TestClient

from src.api.main import app
from src.api.routes import controlled_substances
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer
from src.api.models.compliance_models import RegulatorySource

client = TestClient(app)


BASE_DECISION = {
    "status": "ok_to_ship",
    "reason": "All required facility details present.",
    "missing_fields": [],
    "regulatory_references": ["csf_facility_form"],
}


def test_facility_copilot_stub_mode_returns_success(monkeypatch):
    def fake_explain(decision, question, regulatory_references=None):
        return RegulatoryRagAnswer(
            answer="stubbed explanation",
            regulatory_references=regulatory_references or [],
            artifacts_used=regulatory_references or [],
            sources=[
                RegulatorySource(
                    id="csf_facility_form", title="Facility CSF", snippet="stub"
                )
            ],
            debug={"mode": "stub"},
        )

    monkeypatch.setattr(
        controlled_substances, "explain_csf_facility_decision", fake_explain
    )

    resp = client.post(
        "/csf/facility/form-copilot",
        json={
            "decision": BASE_DECISION,
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["engine_family"] == "csf"
    assert data["decision_type"] == "csf_facility"
    assert "stub mode" in data["explanation"]
    assert data["rag_sources"][0]["id"] == "csf_facility_form"


def test_facility_copilot_handles_rag_failure(monkeypatch):
    def failing_explain(*args, **kwargs):
        raise RuntimeError("rag failure")

    monkeypatch.setattr(
        controlled_substances, "explain_csf_facility_decision", failing_explain
    )

    resp = client.post(
        "/csf/facility/form-copilot",
        json={
            "decision": BASE_DECISION,
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "stub mode" in data["explanation"].lower()
    assert data["rag_sources"] == []
