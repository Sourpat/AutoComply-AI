from fastapi.testclient import TestClient

from src.api.main import app
from src.api.models.compliance_models import RegulatorySource
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer
import src.autocomply.domain.csf_copilot as csf_copilot

client = TestClient(app)

BASE_FORM_PAYLOAD = {
    "facility_name": "Test Dental Practice",
    "facility_type": "dental_practice",
    "account_number": "A123",
    "practitioner_name": "Dr. Test",
    "state_license_number": "ST-100",
    "dea_number": "DEA-100",
    "ship_to_state": "OH",
    "attestation_accepted": True,
    "internal_notes": None,
}


def test_practitioner_copilot_returns_structured_explanation(monkeypatch):
    def fake_explain(*args, **kwargs):
        return RegulatoryRagAnswer(
            answer="mocked rag answer",
            regulatory_references=[],
            artifacts_used=[],
            sources=[
                RegulatorySource(id="csf", title="CSF", snippet="mock")
            ],
            debug={"mock": True},
        )

    # Target the exact import path used inside the copilot domain module
    monkeypatch.setattr(
        csf_copilot,
        "explain_csf_practitioner_decision",
        fake_explain,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    reason = resp.json()["reason"]
    assert "Based on the information provided" in reason
    assert "Practitioner CSF" in reason
    assert "approved to proceed" in reason or "ok to ship" in reason


def test_practitioner_copilot_rag_failure_falls_back(monkeypatch):
    def failing(*args, **kwargs):
        raise RuntimeError("fail")

    monkeypatch.setattr(
        csf_copilot,
        "explain_csf_practitioner_decision",
        failing,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    reason = resp.json()["reason"]
    assert "Based on the information provided" in reason
    assert "Practitioner CSF" in reason
