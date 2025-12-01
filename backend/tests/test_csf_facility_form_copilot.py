from unittest.mock import patch

from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_facility
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer
from src.api.models.compliance_models import RegulatorySource

client = TestClient(app)


def test_facility_copilot_returns_explanation(monkeypatch):
    def fake_explain(decision, question, regulatory_references=None):
        return RegulatoryRagAnswer(
            answer="stubbed facility explanation",
            regulatory_references=regulatory_references or [],
            artifacts_used=regulatory_references or [],
            sources=[
                RegulatorySource(
                    id="csf_facility_form", title="Facility CSF", snippet="stub"
                )
            ],
            debug={"mode": "stub"},
        )

    monkeypatch.setattr(
        csf_facility, "explain_csf_facility_decision", fake_explain
    )

    resp = client.post(
        "/csf/facility/form-copilot",
        json={
            "facility_name": "Test Facility",
            "facility_type": "facility",
            "account_number": "ACC-123",
            "pharmacy_license_number": "LIC-123",
            "dea_number": "DEA-456",
            "pharmacist_in_charge_name": "Dr. Smith",
            "pharmacist_contact_phone": "555-1234",
            "ship_to_state": "OH",
            "attestation_accepted": True,
            "controlled_substances": [],
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert "rag_explanation" in data
    assert data["regulatory_references"]
    assert data["rag_sources"][0]["id"] == "csf_facility_form"


def test_facility_copilot_v1_prefix(monkeypatch):
    def fake_explain(**kwargs):
        return RegulatoryRagAnswer(
            answer="stubbed facility explanation",
            sources=[RegulatorySource(id="csf_facility_form", title="Facility CSF", snippet="stub")],
            artifacts_used=[],
            debug={"mode": "stub"},
        )

    with patch.object(csf_facility, "explain_csf_facility_decision", fake_explain):
        resp = client.post(
            "/api/v1/csf/facility/form-copilot",
            json={
                "facility_name": "Test Facility",
                "facility_type": "facility",
                "account_number": "ACC-999",
                "pharmacy_license_number": "PHARM-12345",
                "dea_number": "DEA-7654321",
                "pharmacist_in_charge_name": "Chief Pharmacist",
                "pharmacist_contact_phone": "555-123-4567",
                "ship_to_state": "OH",
                "attestation_accepted": True,
                "internal_notes": None,
                "controlled_substances": [],
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["rag_explanation"]
    assert data["rag_sources"][0]["id"] == "csf_facility_form"
