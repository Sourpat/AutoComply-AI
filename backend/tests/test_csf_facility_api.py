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


def test_facility_csf_explain_endpoint(base_facility_payload: dict) -> None:
    """Test Facility CSF explain endpoint returns 200 with explanation."""
    # First evaluate to get a decision
    eval_resp = client.post("/csf/facility/evaluate", json=base_facility_payload)
    assert eval_resp.status_code == 200
    decision = eval_resp.json()["decision"]

    # Now request explain for the decision
    explain_payload = {
        "csf_type": "facility",
        "decision_status": decision["status"],
        "decision_reason": decision["reason"],
        "missing_fields": [],
        "regulatory_references": decision["regulatory_references"],
    }
    resp = client.post("/csf/explain", json=explain_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "plain_english" in data
    assert isinstance(data["plain_english"], str)
    assert len(data["plain_english"]) > 0
    assert data["csf_type"] == "facility"


def test_facility_csf_rag_regulatory_explain() -> None:
    """Test RAG regulatory explain endpoint returns 200 with answer."""
    payload = {
        "csf_type": "facility",
        "question": "What are the requirements for facility DEA registration?",
        "regulatory_references": ["csf_facility_form"],
        "missing_fields": [],
        "decision_status": "ok_to_ship",
    }
    resp = client.post("/rag/regulatory-explain", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "answer" in data
    assert isinstance(data["answer"], str)
    assert len(data["answer"]) > 0
    assert "sources" in data
    assert isinstance(data["sources"], list)


def test_facility_csf_submit_endpoint(base_facility_payload: dict) -> None:
    """Test Facility CSF submission endpoint returns submission ID."""
    # First evaluate to get a decision
    eval_resp = client.post("/csf/facility/evaluate", json=base_facility_payload)
    assert eval_resp.status_code == 200
    decision_data = eval_resp.json()

    # Now submit for verification
    submit_payload = {
        "facility_name": base_facility_payload["facility_name"],
        "account_number": base_facility_payload["account_number"],
        "decision_status": decision_data["status"],
        "copilot_used": False,
    }
    resp = client.post("/csf/facility/submit", json=submit_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "submission_id" in data
    assert isinstance(data["submission_id"], str)
    assert len(data["submission_id"]) > 0
    assert "submitted_at" in data
    assert data["status"] == decision_data["status"]


def test_facility_csf_get_submission_endpoint(base_facility_payload: dict) -> None:
    """Test retrieving a Facility CSF submission by ID."""
    # First submit
    eval_resp = client.post("/csf/facility/evaluate", json=base_facility_payload)
    assert eval_resp.status_code == 200
    decision_data = eval_resp.json()

    submit_payload = {
        "facility_name": base_facility_payload["facility_name"],
        "account_number": base_facility_payload["account_number"],
        "decision_status": decision_data["status"],
        "copilot_used": False,
    }
    submit_resp = client.post("/csf/facility/submit", json=submit_payload)
    assert submit_resp.status_code == 200
    submission_id = submit_resp.json()["submission_id"]

    # Now retrieve
    get_resp = client.get(f"/csf/facility/submissions/{submission_id}")
    assert get_resp.status_code == 200

    data = get_resp.json()
    assert data["submission_id"] == submission_id
    assert data["facility_name"] == base_facility_payload["facility_name"]
    assert data["account_number"] == base_facility_payload["account_number"]
    assert data["status"] == decision_data["status"]
    assert "submitted_at" in data
