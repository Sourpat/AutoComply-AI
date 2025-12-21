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


def test_csf_practitioner_primary_care_happy_path():
    """Test scenario: Primary care prescriber in NY with clean credentials → ok_to_ship"""
    payload = {
        "facility_name": "Hudson Valley Primary Care",
        "facility_type": "group_practice",
        "account_number": "ACCT-22001",
        "practitioner_name": "Dr. Alicia Patel",
        "state_license_number": "NY-1023498",
        "dea_number": "AP1234567",
        "ship_to_state": "NY",
        "attestation_accepted": True,
        "internal_notes": "Established primary care practice with stable CS prescribing patterns.",
        "controlled_substances": [
            {
                "id": "cs_clonazepam_0_5mg",
                "name": "Clonazepam 0.5mg",
                "ndc": "00093-0063-01",
                "dea_schedule": "IV",
                "schedule": "IV",
            }
        ],
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok_to_ship"
    assert "approved" in data["reason"].lower() or "proceed" in data["reason"].lower()


def test_csf_practitioner_pain_clinic_needs_review():
    """Test scenario: Pain management clinic with Schedule II → needs_review"""
    payload = {
        "facility_name": "Central Ohio Pain Clinic",
        "facility_type": "clinic",
        "account_number": "ACCT-44110",
        "practitioner_name": "Dr. Jordan Reyes",
        "state_license_number": "OH-4432109",
        "dea_number": "BR2345678",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Clinic flagged for periodic review due to high volume of Schedule II prescriptions.",
        "controlled_substances": [
            {
                "id": "cs_oxycodone_10mg",
                "name": "Oxycodone 10mg",
                "ndc": "00406-0512-02",
                "dea_schedule": "II",
                "schedule": "II",
            }
        ],
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "needs_review"
    assert "pain" in data["reason"].lower() or "review" in data["reason"].lower()


def test_csf_practitioner_telehealth_blocked():
    """Test scenario: Telehealth-only prescriber with missing license and no attestation → blocked"""
    payload = {
        "facility_name": "Bridgeway Telehealth",
        "facility_type": "individual_practitioner",
        "account_number": "ACCT-88990",
        "practitioner_name": "Dr. Emily Novak",
        "state_license_number": "",
        "dea_number": "BN3456789",
        "ship_to_state": "OH",
        "attestation_accepted": False,
        "internal_notes": "Telehealth-only practice; state-level restrictions may apply for Schedule II shipments.",
        "controlled_substances": [
            {
                "id": "cs_adderall_xr_20mg",
                "name": "Adderall XR 20mg",
                "ndc": "54092-0381-01",
                "dea_schedule": "II",
                "schedule": "II",
            }
        ],
    }

    resp = client.post("/csf/practitioner/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "blocked"
    # Should have missing fields or attestation issue
    assert len(data["missing_fields"]) > 0 or "attestation" in data["reason"].lower()
