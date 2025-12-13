from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.api.routes.csf_practitioner import router
from src.api.models.compliance_models import RegulatorySource
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer

import src.autocomply.domain.csf_copilot as csf_copilot


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


def test_practitioner_copilot_returns_structured_explanation(monkeypatch):
    """
    Happy-path: RAG returns an answer and references.
    We assert:
    - HTTP 200
    - status is "ok_to_ship"
    - reason contains a stable narrative phrase
    - rag_explanation comes from the mocked RAG answer
    - references / sources are wired through
    """

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
        csf_copilot,
        "explain_csf_practitioner_decision",
        fake_explain,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"

    # Reason is the stable, human-readable summary
    reason = data["reason"]
    assert "Based on the information provided" in reason
    assert "Practitioner CSF" in reason
    assert "approved to proceed" in reason or "ok to ship" in reason

    # RAG answer should appear in rag_explanation, not overwrite reason
    assert data["rag_explanation"] == "mocked rag answer"

    # The rest of the RAG fields should be present and shaped
    assert isinstance(data["regulatory_references"], list)
    assert isinstance(data["rag_sources"], list)
    assert isinstance(data["artifacts_used"], list)


def test_practitioner_copilot_rag_failure_falls_back(monkeypatch):
    """
    If the RAG explainer raises an exception, the API should:
    - Still return 200
    - Still return a structured copilot response
    - Still include the stable narrative `reason`
    - Populate `rag_explanation` with the fallback stub text
    """

    def failing(*args, **kwargs):
        raise RuntimeError("rag failure")

    monkeypatch.setattr(
        csf_copilot,
        "explain_csf_practitioner_decision",
        failing,
    )

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"

    reason = data["reason"]
    assert "Based on the information provided" in reason
    assert "Practitioner CSF" in reason

    # RAG is down, so rag_explanation should contain the stub text
    rag_explanation = data["rag_explanation"]
    assert "Regulatory RAG explanation is currently unavailable" in rag_explanation
