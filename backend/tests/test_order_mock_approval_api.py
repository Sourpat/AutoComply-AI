import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


@pytest.fixture
def ohio_facility_ok_payload() -> dict:
    return {
        "facility_csf_decision": "ok_to_ship",
        "ohio_tddd_decision": "ok_to_ship",
    }


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


def make_non_ohio_hospital_csf_payload() -> dict:
    """
    Scenario:
    - Hospital is shipping to a non-Ohio state (e.g. PA).
    - CSF is still correct.
    - We will NOT send any Ohio TDDD payload in the mock order request.
    """
    return {
        "facility_name": "Pennsylvania General Hospital",
        "facility_type": "hospital",
        "account_number": "800987654",
        "pharmacy_license_number": "LIC-98765",
        "dea_number": "CD7654321",
        "pharmacist_in_charge_name": "Dr. John Smith",
        "pharmacist_contact_phone": "555-987-6543",
        "ship_to_state": "PA",
        "attestation_accepted": True,
        "internal_notes": "Mock order test – non-Ohio hospital Schedule II.",
        "controlled_substances": [
            {
                "id": "cs-oxy-10mg-tab",
                "name": "Oxycodone 10 mg tablet",
                "ndc": "98765-4321-01",
                "strength": "10 mg",
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
        "expiration_date": "2099-12-31",
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
        "expiration_date": "2099-12-31",
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


def test_mock_order_non_ohio_hospital_no_tddd_still_ok_to_ship() -> None:
    """
    Scenario:

    - Hospital ships to a non-Ohio state (e.g. PA).
    - We send only the Hospital CSF payload, with NO Ohio TDDD payload.
    - The mock order endpoint should:
      - Evaluate the CSF.
      - Skip TDDD evaluation.
      - Return final_decision = ok_to_ship (assuming CSF is ok_to_ship).

    This demonstrates that the TDDD engine is optional and only needed
    when the business flow requires Ohio-specific license checks.
    """
    csf_payload = make_non_ohio_hospital_csf_payload()

    resp = client.post(
        "/orders/mock/ohio-hospital-approval",
        json={
            "hospital_csf": csf_payload,
            # NOTE: we intentionally omit "ohio_tddd" here.
        },
    )

    assert resp.status_code == 200
    data = resp.json()

    # Basic shape checks
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
    # With no TDDD payload, we expect tddd_status to be null/None.
    assert data["tddd_status"] is None
    # Final decision should be ok_to_ship if CSF is ok_to_ship and no TDDD issues.
    assert data["final_decision"] == "ok_to_ship"

    notes = data["notes"]
    assert isinstance(notes, list)
    # Soft check that notes mention skipping TDDD.
    assert any("skipping license evaluation" in n.lower() for n in notes)


def test_mock_ohio_facility_order_ok(
    ohio_facility_ok_payload: dict,
) -> None:
    resp = client.post("/orders/mock/ohio-facility-approval", json=ohio_facility_ok_payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["final_decision"] == "ok_to_ship"
    assert "facility" in body["explanation"].lower()


def test_mock_ohio_facility_order_blocked_when_any_blocked(
    ohio_facility_ok_payload: dict,
) -> None:
    payload = dict(ohio_facility_ok_payload)
    payload["facility_csf_decision"] = "blocked"
    resp = client.post("/orders/mock/ohio-facility-approval", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["final_decision"] == "blocked"

    payload2 = dict(ohio_facility_ok_payload)
    payload2["ohio_tddd_decision"] = "blocked"
    resp2 = client.post("/orders/mock/ohio-facility-approval", json=payload2)
    assert resp2.status_code == 200
    body2 = resp2.json()
    assert body2["final_decision"] == "blocked"


def test_mock_ohio_facility_order_needs_review_when_no_blocked(
    ohio_facility_ok_payload: dict,
) -> None:
    payload = dict(ohio_facility_ok_payload)
    payload["facility_csf_decision"] = "needs_review"
    resp = client.post("/orders/mock/ohio-facility-approval", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["final_decision"] == "needs_review"


def test_ohio_hospital_mock_order_blocked_when_license_blocked() -> None:
    csf_payload = make_ohio_hospital_csf_payload()

    blocked_tddd_payload = make_ohio_tddd_payload_valid()
    blocked_tddd_payload["attestation_accepted"] = False

    resp = client.post(
        "/orders/mock/ohio-hospital-approval",
        json={
            "hospital_csf": csf_payload,
            "ohio_tddd": blocked_tddd_payload,
        },
    )

    assert resp.status_code == 200
    body = resp.json()

    assert body["tddd_status"] == "blocked"
    assert body["final_decision"] == "blocked"


def test_ohio_facility_mock_order_blocked_when_csf_blocked() -> None:
    payload = {
        "facility_csf_decision": "blocked",
        "ohio_tddd_decision": "ok_to_ship",
    }
    resp = client.post("/orders/mock/ohio-facility-approval", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["final_decision"] == "blocked"


def test_ny_pharmacy_mock_order_ok_to_ship_happy_path() -> None:
    """
    Simple happy path to show that when all NY checks pass,
    the mock order endpoint stays out of the way and returns ok_to_ship.
    """

    resp = client.get("/orders/mock/ny-pharmacy-approval")
    assert resp.status_code == 200

    body = resp.json()
    assert body["final_decision"] == "ok_to_ship"
