from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_debug_print_routes():
    for route in app.routes:
        print("ROUTE:", route.path, "METHODS:", route.methods)
    # This used to force a failure just to dump the route table.
    # Keeping it as a no-op so CI passes while still allowing route debug output if needed.
    assert True


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
    assert resp.json()["status"] == "ok_to_ship"


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
    assert resp.json()["status"] == "blocked"


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
    assert resp.json()["status"] == "blocked"
