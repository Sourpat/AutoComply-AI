from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_csf_hospital_evaluate_ok_to_ship():
    payload = {
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

    resp = client.post("/csf/hospital/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert data["missing_fields"] == []


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
    assert data["status"] == "blocked"
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
    assert data["status"] == "blocked"
    assert "attestation_accepted" in data["missing_fields"]
