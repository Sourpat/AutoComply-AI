"""
Practitioner CSF vertical tests.

These tests validate the Practitioner CSF vertical behavior using the
canonical decision contract, aligned with the narrative in:

backend/docs/verticals/practitioner_csf_vertical.md

Scenarios covered (doc sections):
- Scenario 1 – Practitioner form complete, no red flags
- Scenario 2 – Missing key practitioner or license information
- Scenario 3 – Red-flag answers suggesting potential non-compliance
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_practitioner
from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus

client = TestClient(app)


@pytest.fixture
def base_practitioner_payload() -> dict:
    """Minimal happy-path payload for the Practitioner CSF evaluate endpoint."""

    return {
        "facility_name": "SummitCare Clinics – Downtown",
        "facility_type": "dental_practice",
        "account_number": "ACCT-2024-PRAC",
        "practitioner_name": "Dr. Alicia Patel",
        "state_license_number": "NY-1023498",
        "dea_number": "AP1234567",
        "ship_to_state": "NY",
        "attestation_accepted": True,
        "internal_notes": "Pytest practitioner CSF happy path.",
        "controlled_substances": [
            {
                "id": "cs-clonazepam-05", 
                "name": "Clonazepam 0.5mg",
                "ndc": "00093-0063-01",
                "dea_schedule": "IV",
                "dosage_form": "tablet",
            }
        ],
    }


def test_practitioner_csf_scenario_1_complete_no_red_flags(
    base_practitioner_payload: dict,
) -> None:
    """
    Scenario 1 – Practitioner form complete, no red flags

    Expectation:
    - status: success path (e.g., ok_to_ship or equivalent)
    - risk_level: low
    - reason: practitioner CSF appears complete and acceptable
    - missing_fields: empty or minimal
    """
    resp = client.post("/csf/practitioner/evaluate", json=base_practitioner_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data

    decision = data["decision"]
    # Canonical decision contract expectations for Scenario 1
    assert decision["status"] in ["ok_to_ship", "needs_review", "blocked"]
    assert isinstance(decision["reason"], str) and len(decision["reason"]) > 0
    assert isinstance(decision["regulatory_references"], list)

    # Response mirrors decision contract wrapper fields
    assert data["status"] == decision["status"]
    assert data["reason"] == decision["reason"]
    # For a clean scenario, missing_fields should be empty or minimal
    assert data["missing_fields"] == []
    assert isinstance(data.get("regulatory_references", []), list)

    # Regulatory references should follow decision contract shape
    for ref in decision["regulatory_references"]:
        assert isinstance(ref["id"], str)
        assert isinstance(ref["label"], str)


def test_practitioner_csf_scenario_2_missing_key_license_info(
    base_practitioner_payload: dict,
) -> None:
    """
    Scenario 2 – Missing key practitioner or license information

    Expectation:
    - status: needs_review or blocked (per current rules/tests)
    - risk_level: medium (needs_review) or high (blocked)
    - reason: highlights missing practitioner/license info
    - missing_fields: lists the missing practitioner/license fields
    """
    payload = {
        **base_practitioner_payload,
        "facility_name": "",
        "practitioner_name": "",
        "state_license_number": "",
        "dea_number": "",
        "ship_to_state": "",
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    # Scenario 2 – missing key practitioner / license info
    assert decision["status"] == "blocked"
    assert data["status"] == decision["status"]
    assert isinstance(decision["regulatory_references"], list)
    # Reason + missing_fields must surface the gaps clearly
    assert "facility_name" in data["missing_fields"]
    assert "practitioner_name" in data["missing_fields"]
    assert "state_license_number" in data["missing_fields"]
    assert "dea_number" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_practitioner_csf_scenario_3_red_flag_answers_high_risk(
    base_practitioner_payload: dict,
) -> None:
    """
    Scenario 3 – Red-flag answers suggesting potential non-compliance

    Expectation:
    - status: typically blocked for clearly non-compliant patterns
    - risk_level: high
    - reason: responses indicate potential non-compliance or elevated risk
    - regulatory_references: may include controlled substances guidance
    """
    payload = {
        **base_practitioner_payload,
        "ship_to_state": "FL",
        "controlled_substances": [
            {
                "id": "cs-oxy-5mg-tab",
                "name": "Oxycodone 5mg",
                "ndc": "00406-0512-01",
                "dea_schedule": "II",
                "dosage_form": "tablet",
            }
        ],
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    # Scenario 3 – red-flag answers and elevated risk
    assert decision["status"] == "needs_review"
    assert data["status"] == decision["status"]
    # Regulatory references should surface Florida-specific addendum expectations
    assert "csf_fl_addendum" in data["regulatory_references"]


def test_practitioner_csf_evaluate_blocked_when_attestation_not_accepted(
    base_practitioner_payload: dict,
) -> None:
    payload = {**base_practitioner_payload, "attestation_accepted": False}

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    # Attestation is required per decision contract expectations
    assert decision["status"] == "blocked"
    assert data["status"] == decision["status"]
    assert isinstance(decision["regulatory_references"], list)
    assert "attestation_accepted" in data["missing_fields"]


@pytest.mark.skipif(
    "/csf/practitioner/form-copilot" not in [route.path for route in app.routes],
    reason="Practitioner form copilot endpoint not available",
)
def test_practitioner_csf_form_copilot_basic(
    monkeypatch: pytest.MonkeyPatch, base_practitioner_payload: dict
) -> None:
    async def fake_copilot(request=None, **kwargs):
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="Practitioner CSF approved via copilot stub.",
            missing_fields=["state_license_number"],
            regulatory_references=[
                RegulatoryReference(
                    id="csf_practitioner_form",
                    label="Practitioner CSF – core requirements",
                    source="Practitioner Controlled Substance Form (stub)",
                )
            ],
            rag_explanation="Practitioner CSF copilot stub.",
            artifacts_used=["csf_practitioner_form"],
            rag_sources=[
                RegulatorySource(
                    id="csf_practitioner_form",
                    title="Practitioner CSF",
                    snippet="stub",
                )
            ],
        )

    monkeypatch.setattr(csf_practitioner, "run_csf_copilot", fake_copilot)

    resp = client.post("/csf/practitioner/form-copilot", json=base_practitioner_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data.get("missing_fields"), list)
    refs = data.get("regulatory_references", [])
    assert isinstance(refs, list)
    assert refs and refs[0]["id"] == "csf_practitioner_form"
    rag_sources = data.get("rag_sources", [])
    assert rag_sources and rag_sources[0]["id"] == "csf_practitioner_form"
