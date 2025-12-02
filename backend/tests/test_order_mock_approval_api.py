from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def make_ohio_hospital_csf_payload() -> dict:
    return {
        "facility_name": "Ohio General Hospital",
        "facility_type": "hospital",
        "account_number": "800123456",
        "pharmacy_license_number": "LIC-12345",
        "dea_number": "AB1234567",
        "pharmacist_in_charge_name": "Dr. Jane Doe",
        "pharmacist_contact_phone": "555-123-4567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Mock order test – Ohio hospital Schedule II.",
        "controlled_substances": [
            {
                "id": "cs-oxy-5mg-tab",
                "name": "Oxycodone 5 mg tablet",
                "ndc": "12345-6789-01",
                "strength": "5 mg",
                "dosage_form": "tablet",
                "dea_schedule": "II",
            }
        ],
    }


def make_ohio_tddd_payload_valid() -> dict:
    return {
        "tddd_number": "01234567",
        "facility_name": "Ohio General Hospital",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Valid Ohio TDDD license for mock order test.",
    }


def make_ohio_tddd_payload_missing_number() -> dict:
    return {
        "tddd_number": "",
        "facility_name": "Ohio General Hospital",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Missing TDDD number for negative mock order test.",
    }


def test_mock_order_ohio_hospital_happy_path_ok_to_ship() -> None:
    """
    Happy path:

    - Ohio hospital CSF is ok_to_ship.
    - Ohio TDDD license is ok_to_ship.
    - Final mock order decision should be ok_to_ship.
    """

    csf_payload = make_ohio_hospital_csf_payload()
    tddd_payload = make_ohio_tddd_payload_valid()

    resp = client.post(
        "/orders/mock/ohio-hospital-approval",
        json={
            "hospital_csf": csf_payload,
            "ohio_tddd": tddd_payload,
        },
    )

    assert resp.status_code == 200
    data = resp.json()

    for key in [
        "csf_status",
        "csf_reason",
        "csf_missing_fields",
        "tddd_status",
        "tddd_reason",
        "tddd_missing_fields",
        "final_decision",
        "notes",
    ]:
        assert key in data

    assert data["csf_status"] == "ok_to_ship"
    assert data["tddd_status"] == "ok_to_ship"
    assert data["final_decision"] == "ok_to_ship"

    notes = data["notes"]
    assert isinstance(notes, list)
    assert any("Hospital CSF decision" in n for n in notes)
    assert any("Ohio TDDD decision" in n for n in notes)
    assert any("Final mock order decision" in n for n in notes)


def test_mock_order_ohio_hospital_csf_ok_but_tddd_missing() -> None:
    """
    Negative path:

    - Ohio hospital CSF is still ok_to_ship.
    - Ohio TDDD license is missing the TDDD number.
    - Final mock order decision should NOT be ok_to_ship.

    We allow the engine to decide between needs_review vs blocked,
    but we assert that final_decision != ok_to_ship.
    """

    csf_payload = make_ohio_hospital_csf_payload()
    tddd_payload = make_ohio_tddd_payload_missing_number()

    resp = client.post(
        "/orders/mock/ohio-hospital-approval",
        json={
            "hospital_csf": csf_payload,
            "ohio_tddd": tddd_payload,
        },
    )

    assert resp.status_code == 200
    data = resp.json()

    assert data["csf_status"] == "ok_to_ship"
    assert data["tddd_status"] in {"needs_review", "blocked"}
    assert data["final_decision"] in {"needs_review", "blocked"}
    assert data["final_decision"] != "ok_to_ship"

    notes = data["notes"]
    assert isinstance(notes, list)
    assert any("Ohio TDDD decision" in n for n in notes)
