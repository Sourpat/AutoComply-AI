from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes.csf_practitioner import router
from src.api.models.compliance_models import RegulatorySource
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer

import src.api.routes.csf_practitioner as csf_practitioner_route

app = FastAPI()
app.include_router(router)

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


def test_practitioner_copilot_returns_rag_reason(monkeypatch):
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

    # patch the function used inside the route module
    monkeypatch.setattr(
        csf_practitioner_route,
        "explain_csf_practitioner_decision",
        fake_explain,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"

    # reason is the stable narrative
    reason = data["reason"]
    assert "Based on the information provided" in reason
    assert "Practitioner CSF" in reason

    # rag_explanation should contain the mocked RAG answer
    assert "mocked rag answer" in data["rag_explanation"]


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

    reason = data["reason"]
    # fallback still uses the same narrative template
    assert "Based on the information provided" in reason
    assert "Practitioner CSF" in reason
