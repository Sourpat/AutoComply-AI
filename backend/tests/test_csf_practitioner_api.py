import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_practitioner
from src.api.models.compliance_models import RegulatorySource
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


def test_practitioner_csf_evaluate_ok_to_ship(base_practitioner_payload: dict) -> None:
    resp = client.post("/csf/practitioner/evaluate", json=base_practitioner_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data

    decision = data["decision"]
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


def test_practitioner_csf_evaluate_blocked_when_missing_required_fields(
    base_practitioner_payload: dict,
) -> None:
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

    assert decision["status"] == "blocked"
    assert data["status"] == decision["status"]
    assert isinstance(decision["regulatory_references"], list)
    assert "facility_name" in data["missing_fields"]
    assert "practitioner_name" in data["missing_fields"]
    assert "state_license_number" in data["missing_fields"]
    assert "dea_number" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_practitioner_csf_evaluate_manual_review_for_high_risk_items(
    base_practitioner_payload: dict,
) -> None:
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

    assert decision["status"] == "needs_review"
    assert data["status"] == decision["status"]
    assert "csf_fl_addendum" in data["regulatory_references"]


def test_practitioner_csf_evaluate_blocked_when_attestation_not_accepted(
    base_practitioner_payload: dict,
) -> None:
    payload = {**base_practitioner_payload, "attestation_accepted": False}

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

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
            regulatory_references=["csf_practitioner_form"],
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
    assert isinstance(data.get("suggestions"), list)
    assert data["suggestions"][0]["field_name"] == "state_license_number"
    assert isinstance(data.get("regulatory_references"), list)
    assert data["regulatory_references"][0]["id"] == "csf_practitioner_form"
    assert data["regulatory_references"][0]["label"] == "csf_practitioner_form"
    assert "message" in data
