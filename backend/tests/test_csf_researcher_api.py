from fastapi.testclient import TestClient

from autocomply.domain.csf_practitioner import CsDecisionStatus
from src.api.main import app

client = TestClient(app)


def test_csf_researcher_evaluate_ok_to_ship():
    payload = {
        "institution_name": "Test University",
        "facility_type": "university",
        "account_number": "ACC-R-001",
        "principal_investigator_name": "Dr. Test PI",
        "researcher_title": "Principal Investigator",
        "state_license_number": None,
        "dea_number": None,
        "protocol_or_study_id": "PROT-12345",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": None,
    }

    resp = client.post("/csf/researcher/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == CsDecisionStatus.OK_TO_SHIP.value
    assert data["missing_fields"] == []


def test_csf_researcher_evaluate_blocked_when_missing_core_fields():
    payload = {
        "institution_name": "",
        "facility_type": "university",
        "account_number": "ACC-R-001",
        "principal_investigator_name": "",
        "researcher_title": "Principal Investigator",
        "state_license_number": None,
        "dea_number": None,
        "protocol_or_study_id": "",
        "ship_to_state": "",
        "attestation_accepted": True,
        "internal_notes": None,
    }

    resp = client.post("/csf/researcher/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == CsDecisionStatus.BLOCKED.value
    assert "institution_name" in data["missing_fields"]
    assert "principal_investigator_name" in data["missing_fields"]
    assert "protocol_or_study_id" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_csf_researcher_evaluate_blocked_when_attestation_not_accepted():
    payload = {
        "institution_name": "Test University",
        "facility_type": "university",
        "account_number": "ACC-R-001",
        "principal_investigator_name": "Dr. Test PI",
        "researcher_title": "Principal Investigator",
        "state_license_number": None,
        "dea_number": None,
        "protocol_or_study_id": "PROT-12345",
        "ship_to_state": "OH",
        "attestation_accepted": False,
        "internal_notes": None,
    }

    resp = client.post("/csf/researcher/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == CsDecisionStatus.BLOCKED.value
    assert "attestation_accepted" in data["missing_fields"]
