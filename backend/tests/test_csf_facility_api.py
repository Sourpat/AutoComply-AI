import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_facility
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus
from src.api.models.compliance_models import RegulatorySource

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


def test_csf_facility_evaluate_ok_to_ship(base_facility_payload: dict) -> None:
    resp = client.post("/csf/facility/evaluate", json=base_facility_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []
    assert "reason" in data


def test_csf_facility_evaluate_ok_to_ship_v1_prefix(base_facility_payload: dict) -> None:
    resp = client.post("/api/v1/csf/facility/evaluate", json=base_facility_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []


def test_csf_facility_evaluate_blocked_when_core_fields_missing(
    base_facility_payload: dict,
) -> None:
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
    assert data["status"] == "blocked"
    assert "facility_name" in data["missing_fields"]
    assert "pharmacy_license_number" in data["missing_fields"]
    assert "dea_number" in data["missing_fields"]
    assert "pharmacist_in_charge_name" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_csf_facility_evaluate_blocked_when_attestation_not_accepted(
    base_facility_payload: dict,
) -> None:
    payload = {**base_facility_payload, "attestation_accepted": False}

    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
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
            missing_fields=[],
            regulatory_references=["csf_facility_form"],
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
    assert data["status"] == "ok_to_ship"
    assert "reason" in data
    assert "missing_fields" in data
    assert "regulatory_references" in data
    assert data["rag_sources"][0]["id"] == "csf_facility_form"
