from typing import Any, Dict

from fastapi.testclient import TestClient

from src.api.main import app
from src.api.models.compliance_models import RegulatorySource
from src.api.routes import csf_researcher
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus

client = TestClient(app)


def make_valid_researcher_csf_payload() -> Dict[str, Any]:
    return {
        "facility_name": "University Research Lab – MA",
        "facility_type": "researcher",
        "account_number": "910123456",
        "pharmacy_license_number": "MA-RES-2025-001",
        "dea_number": "RS1234567",
        "pharmacist_in_charge_name": "Dr. Dana Example",
        "pharmacist_contact_phone": "555-400-9001",
        "ship_to_state": "MA",
        "attestation_accepted": True,
        "internal_notes": "Happy path Researcher CSF test payload.",
        "controlled_substances": [
            {"id": "fentanyl", "name": "Fentanyl"},
            {"id": "ketamine", "name": "Ketamine"},
        ],
    }


def test_csf_researcher_evaluate_ok_to_ship():
    payload = make_valid_researcher_csf_payload()

    resp = client.post("/csf/researcher/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] in {"ok_to_ship", "manual_review"}
    assert "reason" in data


def test_csf_researcher_form_copilot(monkeypatch):
    async def fake_copilot(request):
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="Researcher CSF is approved to proceed.",
            missing_fields=[],
            regulatory_references=["csf_researcher_form"],
            rag_explanation="stubbed Researcher explanation",
            artifacts_used=["csf_researcher_form"],
            rag_sources=[
                RegulatorySource(
                    id="csf_researcher_form", title="Researcher CSF", snippet="stub"
                )
            ],
        )

    monkeypatch.setattr(csf_researcher, "run_csf_copilot", fake_copilot)

    resp = client.post(
        "/csf/researcher/form-copilot", json=make_valid_researcher_csf_payload()
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["rag_sources"][0]["id"] == "csf_researcher_form"


def test_csf_researcher_invalid_payload_returns_422():
    resp = client.post("/csf/researcher/evaluate", json={"facility_name": ""})

    assert resp.status_code == 422
