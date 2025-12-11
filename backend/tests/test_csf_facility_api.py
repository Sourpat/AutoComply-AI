"""
Facility CSF vertical tests.

These tests validate the Facility CSF vertical behavior using the
canonical decision contract, aligned with:

backend/docs/verticals/facility_csf_vertical.md

Scenarios:
- Scenario 1 – Facility CSF complete & reasonable
- Scenario 2 – Missing critical facility or license details
- Scenario 3 – Facility answers show potential non-compliance
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_facility
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus
from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference

client = TestClient(app)


@pytest.fixture
def base_facility_payload() -> dict:
    return {
        "facility_name": "SummitCare Clinics – East Region",
        "facility_type": "facility",
        "account_number": "ACCT-445210",
        "pharmacy_license_number": "PHOH-76321",
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Alexis Monroe",
        "pharmacist_contact_phone": "614-555-0198",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Pytest facility CSF happy path.",
        "controlled_substances": [
            {
                "id": "oxy-5mg",
                "name": "Oxycodone 5mg",
                "ndc": "00406-0512-01",
                "dea_schedule": "II",
                "dosage_form": "tablet",
            }
        ],
    }


def test_facility_csf_scenario_1_complete_acceptable(
    base_facility_payload: dict,
) -> None:
    """
    Scenario 1 – Facility CSF complete & reasonable.

    Checks that a complete Facility CSF response returns a canonical
    decision with aligned status/reason/missing fields values.
    """
    resp = client.post("/csf/facility/evaluate", json=base_facility_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data

    decision = data["decision"]
    # Canonical decision contract expectations
    assert decision["status"] in ["ok_to_ship", "needs_review", "blocked"]
    assert isinstance(decision["reason"], str) and len(decision["reason"]) > 0
    assert isinstance(decision["regulatory_references"], list)

    assert data["status"] == decision["status"]
    assert data["reason"] == decision["reason"]
    assert data["missing_fields"] == []
    assert isinstance(data.get("regulatory_references", []), list)

    for ref in decision["regulatory_references"]:
        assert isinstance(ref["id"], str)
        assert isinstance(ref["label"], str)


def test_facility_csf_scenario_1_ok_to_ship_v1_prefix(
    base_facility_payload: dict,
) -> None:
    """
    Scenario 1 variant – V1-prefixed endpoint still returns ok_to_ship.
    """
    resp = client.post("/api/v1/csf/facility/evaluate", json=base_facility_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data
    assert data["decision"]["status"] == "ok_to_ship"
    assert data["status"] == data["decision"]["status"]
    assert data["missing_fields"] == []


def test_facility_csf_scenario_2_missing_critical_info(
    base_facility_payload: dict,
) -> None:
    """
    Scenario 2 – Missing critical facility or license details.
    """
    payload = {
        **base_facility_payload,
        "facility_name": "",
        "pharmacy_license_number": "",
        "dea_number": "",
        "pharmacist_in_charge_name": "",
        "ship_to_state": "",
    }

    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    # Canonical decision contract expectations
    assert decision["status"] == "blocked"
    assert data["status"] == decision["status"]
    assert isinstance(decision["regulatory_references"], list)
    assert "facility_name" in data["missing_fields"]
    assert "pharmacy_license_number" in data["missing_fields"]
    assert "dea_number" in data["missing_fields"]
    assert "pharmacist_in_charge_name" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_facility_csf_scenario_3_high_risk_responses(
    base_facility_payload: dict,
) -> None:
    """
    Scenario 3 – Facility answers show potential non-compliance.
    """
    payload = {**base_facility_payload, "attestation_accepted": False}

    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    # Canonical decision contract expectations
    assert decision["status"] == "blocked"
    assert data["status"] == decision["status"]
    assert isinstance(decision["regulatory_references"], list)
    assert "attestation_accepted" in data["missing_fields"]


@pytest.mark.skipif(
    "/csf/facility/form-copilot" not in [route.path for route in app.routes],
    reason="Facility form copilot endpoint not available",
)
def test_csf_facility_form_copilot_basic(
    monkeypatch: pytest.MonkeyPatch, base_facility_payload: dict
) -> None:
    async def fake_copilot(request=None, **kwargs):
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="Facility CSF is approved to proceed.",
            missing_fields=["pharmacist_contact_phone"],
            regulatory_references=[
                RegulatoryReference(
                    id="csf_facility_form",
                    label="Facility CSF – core requirements",
                    source="Facility Controlled Substance Form (stub)",
                )
            ],
            rag_explanation="Facility CSF copilot stub.",
            artifacts_used=["csf_facility_form"],
            rag_sources=[
                RegulatorySource(
                    id="csf_facility_form", title="Facility CSF", snippet="stub"
                )
            ],
        )

    monkeypatch.setattr(csf_facility, "run_csf_copilot", fake_copilot)

    resp = client.post("/csf/facility/form-copilot", json=base_facility_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data.get("missing_fields"), list)
    refs = data.get("regulatory_references", [])
    assert isinstance(refs, list)
    assert refs and refs[0]["id"] == "csf_facility_form"
    rag_sources = data.get("rag_sources", [])
    assert rag_sources and rag_sources[0]["id"] == "csf_facility_form"
