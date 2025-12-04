import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_hospital
from src.api.models.compliance_models import RegulatorySource
from src.api.models.decision import RegulatoryReference
from src.autocomply.domain.csf_copilot import CsfCopilotResult
from src.autocomply.domain.csf_practitioner import CsDecisionStatus


@pytest.fixture
def base_hospital_payload() -> dict:
    return {
        "facility_name": "Test General Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-999",
        "pharmacy_license_number": "PHARM-12345",
        "dea_number": "DEA-7654321",
        "pharmacist_in_charge_name": "Chief Pharmacist",
        "pharmacist_contact_phone": "555-123-4567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": None,
    }

client = TestClient(app)


def test_csf_hospital_evaluate_ok_to_ship(base_hospital_payload: dict):
    resp = client.post("/csf/hospital/evaluate", json=base_hospital_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data

    decision = data["decision"]
    assert decision["status"] in ["ok_to_ship", "needs_review", "blocked"]
    assert isinstance(decision["reason"], str) and len(decision["reason"]) > 0
    assert isinstance(decision["regulatory_references"], list)

    # Legacy passthrough fields should mirror the decision for backward compatibility.
    assert data["status"] == decision["status"]
    assert data["reason"] == decision["reason"]
    assert data["missing_fields"] == []

    for ref in decision["regulatory_references"]:
        assert isinstance(ref["id"], str)
        assert isinstance(ref["label"], str)


def test_csf_hospital_evaluate_blocked_when_core_fields_missing():
    payload = {
        "facility_name": "",
        "facility_type": "hospital",
        "account_number": "ACC-999",
        "pharmacy_license_number": "",
        "dea_number": "",
        "pharmacist_in_charge_name": "",
        "pharmacist_contact_phone": "555-123-4567",
        "ship_to_state": "",
        "attestation_accepted": True,
        "internal_notes": None,
    }

    resp = client.post("/csf/hospital/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    assert decision["status"] == "blocked"
    assert data["status"] == "blocked"
    assert isinstance(decision["regulatory_references"], list)
    assert data["missing_fields"]
    assert "facility_name" in data["missing_fields"]
    assert "pharmacy_license_number" in data["missing_fields"]
    assert "dea_number" in data["missing_fields"]
    assert "pharmacist_in_charge_name" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_csf_hospital_evaluate_blocked_when_attestation_not_accepted():
    payload = {
        "facility_name": "Test General Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-999",
        "pharmacy_license_number": "PHARM-12345",
        "dea_number": "DEA-7654321",
        "pharmacist_in_charge_name": "Chief Pharmacist",
        "pharmacist_contact_phone": "555-123-4567",
        "ship_to_state": "OH",
        "attestation_accepted": False,
        "internal_notes": None,
    }

    resp = client.post("/csf/hospital/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = data["decision"]

    assert decision["status"] == "blocked"
    assert data["status"] == "blocked"
    assert isinstance(decision["regulatory_references"], list)
    assert isinstance(decision.get("reason"), str)
    assert "attestation_accepted" in data["missing_fields"]


@pytest.mark.skipif(
    "/csf/hospital/form-copilot" not in [route.path for route in app.routes],
    reason="Hospital form copilot endpoint not available",
)
def test_csf_hospital_form_copilot_basic(
    monkeypatch: pytest.MonkeyPatch, base_hospital_payload: dict
) -> None:
    async def fake_copilot(request=None, **kwargs):
        return CsfCopilotResult(
            status=CsDecisionStatus.OK_TO_SHIP,
            reason="Hospital CSF approved via copilot stub.",
            missing_fields=["dea_number"],
            regulatory_references=[
                RegulatoryReference(
                    id="csf_hospital_form",
                    label="Hospital CSF – core requirements",
                    source="Hospital Controlled Substance Form (stub)",
                )
            ],
            rag_explanation="Here’s how to complete the hospital CSF form.",
            artifacts_used=["csf_hospital_form"],
            rag_sources=[
                RegulatorySource(
                    id="csf_hospital_form",
                    title="Hospital CSF",
                    snippet="stub",
                )
            ],
        )

    monkeypatch.setattr(csf_hospital, "run_csf_copilot", fake_copilot)

    resp = client.post("/csf/hospital/form-copilot", json=base_hospital_payload)
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data.get("missing_fields"), list)
    refs = data.get("regulatory_references", [])
    assert isinstance(refs, list)
    assert refs and refs[0]["id"] == "csf_hospital_form"
    rag_sources = data.get("rag_sources", [])
    assert rag_sources and rag_sources[0]["id"] == "csf_hospital_form"
