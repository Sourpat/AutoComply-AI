from fastapi.testclient import TestClient

from src.api.main import app
from src.api.models.compliance_models import RegulatorySource
from src.api.routes import csf_practitioner as csf_practitioner_route
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer

client = TestClient(app)


BASE_FORM_PAYLOAD = {
    "facility_name": "Bay Medical Group",
    "facility_type": "individual_practitioner",
    "account_number": "A123",
    "practitioner_name": "Dr. Example",
    "state_license_number": "SL-1234",
    "dea_number": "DEA-123",
    "ship_to_state": "CA",
    "attestation_accepted": True,
    "controlled_substances": [],
}


def test_practitioner_copilot_returns_rag_reason(monkeypatch):
    def fake_explain(decision, question, regulatory_references=None):
        return RegulatoryRagAnswer(
            answer="mocked rag answer",
            regulatory_references=regulatory_references or [],
            artifacts_used=regulatory_references or [],
            sources=[
                RegulatorySource(
                    id="csf_practitioner_form",
                    title="Practitioner CSF",
                    snippet="Mock source",
                )
            ],
            debug={"mode": "mock"},
        )

    monkeypatch.setattr(
        csf_practitioner_route,
        "explain_csf_practitioner_decision",
        fake_explain,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["reason"] == "mocked rag answer"
    assert data["rag_sources"][0]["id"] == "csf_practitioner_form"


def test_practitioner_copilot_rag_failure_falls_back(monkeypatch):
    def failing_explain(*args, **kwargs):
        raise RuntimeError("rag failure")

    monkeypatch.setattr(
        csf_practitioner_route,
        "explain_csf_practitioner_decision",
        failing_explain,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert "Practitioner CSF is approved to proceed" in data["reason"]
    assert data["rag_sources"] == []
