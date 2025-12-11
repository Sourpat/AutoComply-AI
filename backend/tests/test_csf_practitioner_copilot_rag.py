from fastapi.testclient import TestClient

from src.api.main import app
from src.api.models.compliance_models import RegulatorySource
from src.api.routes import csf_practitioner as csf_practitioner_route
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus
from src.api.models.decision import RegulatoryReference

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


def test_practitioner_copilot_returns_structured_explanation(monkeypatch):
    async def fake_copilot(request):
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="mocked rag answer",
            missing_fields=[],
            regulatory_references=[
                RegulatoryReference(
                    id="csf_practitioner_form",
                    label="Practitioner CSF – core requirements",
                    source="Practitioner Controlled Substance Form (stub)",
                )
            ],
            rag_explanation="mocked rag answer",
            artifacts_used=["csf_practitioner_form"],
            rag_sources=[
                RegulatorySource(
                    id="csf_practitioner_form",
                    title="Practitioner CSF",
                    snippet="Mock source",
                )
            ],
        )

    monkeypatch.setattr(csf_practitioner_route, "run_csf_copilot", fake_copilot)

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    # Reason should be the structured explanation from the builder, not the raw mocked RAG text
    assert data["reason"] != "mocked rag answer"
    assert "Based on the information provided" in data["reason"]
    assert "Practitioner CSF" in data["reason"]
    assert data["rag_explanation"] == "mocked rag answer"
    refs = data.get("regulatory_references", [])
    assert isinstance(refs, list)
    assert any(ref["id"] == "csf_practitioner_form" for ref in refs)
    assert data["rag_sources"][0]["id"] == "csf_practitioner_form"
    assert "csf_practitioner_form" in data.get("artifacts_used", [])


def test_practitioner_copilot_uses_practitioner_doc(monkeypatch):
    recorded_request = {}

    async def fake_copilot(request):
        recorded_request.update(request)
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="ok",
            missing_fields=[],
            regulatory_references=[
                RegulatoryReference(
                    id="csf_practitioner_form",
                    label="Practitioner CSF – core requirements",
                    source="Practitioner Controlled Substance Form (stub)",
                )
            ],
            rag_explanation="ok",
            artifacts_used=["csf_practitioner_form"],
            rag_sources=[
                RegulatorySource(
                    id="csf_practitioner_form",
                    title="Practitioner CSF",
                    snippet="Mock",
                )
            ],
        )

    monkeypatch.setattr(csf_practitioner_route, "run_csf_copilot", fake_copilot)

    resp = client.post("/csf/practitioner/form-copilot", json=BASE_FORM_PAYLOAD)
    assert resp.status_code == 200

    data = resp.json()
    assert any("csf_practitioner_form" in a for a in data.get("artifacts_used", []))
    refs = data.get("regulatory_references", [])
    assert any(ref.get("id") == "csf_practitioner_form" for ref in refs)
    assert recorded_request.get("csf_type") == "practitioner"
