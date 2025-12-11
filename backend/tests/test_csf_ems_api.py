"""
EMS CSF vertical tests.

These tests align with backend/docs/verticals/ems_csf_vertical.md and
cover the canonical decision contract for EMS scenarios:

- Scenario 1 – EMS CSF complete & compliant
- Scenario 2 – Missing critical EMS info
- Scenario 3 – High-risk EMS practices (represented via copilot coverage)
"""

from typing import Any, Dict

from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_ems
from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus

client = TestClient(app)


def make_valid_ems_csf_payload() -> Dict[str, Any]:
    return {
        "facility_name": "Metro EMS – NJ",
        "facility_type": "ems",
        "account_number": "900123456",
        "pharmacy_license_number": "NJ-EMS-2025-001",
        "dea_number": "EM1234567",
        "pharmacist_in_charge_name": "Dr. EMS Director",
        "pharmacist_contact_phone": "555-300-9001",
        "ship_to_state": "NJ",
        "attestation_accepted": True,
        "internal_notes": "Happy path EMS CSF test payload.",
        "controlled_substances": [
            {"id": "morphine", "name": "Morphine"},
            {"id": "fentanyl", "name": "Fentanyl"},
        ],
    }


def test_ems_csf_scenario_1_complete_and_compliant():
    payload = make_valid_ems_csf_payload()

    resp = client.post("/csf/ems/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    # Canonical decision contract expectations
    assert data["status"] in {"ok_to_ship", "manual_review"}
    assert "reason" in data


def test_ems_csf_scenario_3_form_copilot(monkeypatch):
    async def fake_copilot(request):
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="EMS CSF is approved to proceed.",
            missing_fields=[],
            regulatory_references=[
                RegulatoryReference(
                    id="csf_ems_form",
                    label="EMS CSF",
                    source="EMS CSF (stub)",
                )
            ],
            rag_explanation="stubbed EMS explanation",
            artifacts_used=["csf_ems_form"],
            rag_sources=[
                RegulatorySource(id="csf_ems_form", title="EMS CSF", snippet="stub")
            ],
        )

    monkeypatch.setattr(csf_ems, "run_csf_copilot", fake_copilot)

    resp = client.post("/csf/ems/form-copilot", json=make_valid_ems_csf_payload())

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["rag_sources"][0]["id"] == "csf_ems_form"


def test_ems_csf_scenario_2_missing_info_returns_422():
    resp = client.post("/csf/ems/evaluate", json={"facility_name": ""})

    assert resp.status_code == 422
