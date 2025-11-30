from starlette.testclient import TestClient

from src.api.main import app
from src.api.routes import csf_hospital
from src.autocomply.domain.rag_regulatory_explain import RegulatoryRagAnswer
from src.api.models.compliance_models import RegulatorySource

client = TestClient(app)


def test_hospital_copilot_returns_explanation(monkeypatch):
    def fake_explain(decision, question, regulatory_references=None):
        return RegulatoryRagAnswer(
            answer="stubbed hospital explanation",
            regulatory_references=regulatory_references or [],
            artifacts_used=regulatory_references or [],
            sources=[
                RegulatorySource(
                    id="csf_hospital_form", title="Hospital CSF", snippet="stub"
                )
            ],
            debug={"mode": "stub"},
        )

    monkeypatch.setattr(
        csf_hospital, "explain_csf_hospital_decision", fake_explain
    )

    resp = client.post(
        "/csf/hospital/form-copilot",
        json={
            "facility_name": "Test Hospital",
            "facility_type": "hospital",
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
    assert data["rag_sources"][0]["id"] == "csf_hospital_form"
