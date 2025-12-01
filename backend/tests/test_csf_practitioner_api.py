from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_csf_practitioner_evaluate_ok_to_ship():
    payload = {
        "facility_name": "Test Dental Practice",
        "facility_type": "dental_practice",
        "account_number": "ACC-123",
        "practitioner_name": "Dr. Test Practitioner",
        "state_license_number": "ST-12345",
        "dea_number": "DEA-1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": None,
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []


def test_csf_practitioner_evaluate_blocked_when_missing_fields():
    payload = {
        "facility_name": "",
        "facility_type": "dental_practice",
        "account_number": "ACC-123",
        "practitioner_name": "",
        "state_license_number": "",
        "dea_number": "",
        "ship_to_state": "",
        "attestation_accepted": True,
        "internal_notes": None,
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
    assert "facility_name" in data["missing_fields"]
    assert "practitioner_name" in data["missing_fields"]
    assert "state_license_number" in data["missing_fields"]
    assert "dea_number" in data["missing_fields"]
    assert "ship_to_state" in data["missing_fields"]


def test_csf_practitioner_evaluate_blocked_when_attestation_not_accepted():
    payload = {
        "facility_name": "Test Dental Practice",
        "facility_type": "dental_practice",
        "account_number": "ACC-123",
        "practitioner_name": "Dr. Test Practitioner",
        "state_license_number": "ST-12345",
        "dea_number": "DEA-1234567",
        "ship_to_state": "OH",
        "attestation_accepted": False,
        "internal_notes": None,
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
    assert "attestation_accepted" in data["missing_fields"]


def make_valid_practitioner_csf_payload() -> dict:
    return {
        "facility_name": "Test Dental Practice",
        "facility_type": "dental_practice",
        "account_number": "ACC-123",
        "practitioner_name": "Dr. Test Practitioner",
        "state_license_number": "ST-12345",
        "dea_number": "DEA-1234567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": None,
        "controlled_substances": [],
    }


def test_csf_practitioner_form_copilot_ok() -> None:
    payload = make_valid_practitioner_csf_payload()
    resp = client.post("/csf/practitioner/form-copilot", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "status" in data
    assert "reason" in data
    assert "missing_fields" in data
    assert "regulatory_references" in data
    assert "rag_explanation" in data
    assert "artifacts_used" in data
    assert "rag_sources" in data


def test_csf_practitioner_uses_practitioner_doc() -> None:
    payload = make_valid_practitioner_csf_payload()
    resp = client.post("/csf/practitioner/form-copilot", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    artifacts = data.get("artifacts_used", [])
    assert any("csf_practitioner_form" in a for a in artifacts)
