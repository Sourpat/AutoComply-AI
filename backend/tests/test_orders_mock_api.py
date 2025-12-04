import pytest
from fastapi.testclient import TestClient

from src.api.main import app


client = TestClient(app)


# Helper payload builders mirror the happy-path demo scenarios used across the
# mock order sandboxes.
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


def make_ohio_facility_payload() -> dict:
    return {
        "facility_csf_decision": "ok_to_ship",
        "ohio_tddd_decision": "ok_to_ship",
    }


def make_ny_pharmacy_payload() -> dict:
    return {
        "ny_pharmacy": {
            "pharmacy_name": "Hudson Valley Pharmacy",
            "account_number": "900111222",
            "ship_to_state": "NY",
            "dea_number": "FG7654321",
            "ny_state_license_number": "NYPHARM-009876",
            "attestation_accepted": True,
            "internal_notes": "NY Pharmacy mock order – all checks green.",
        }
    }


@pytest.mark.parametrize(
    "path,payload",
    [
        (
            "/orders/mock/ohio-hospital-approval",
            lambda: {
                "hospital_csf": make_ohio_hospital_csf_payload(),
                "ohio_tddd": make_ohio_tddd_payload_valid(),
            },
        ),
        (
            "/orders/mock/ohio-facility-approval",
            make_ohio_facility_payload,
        ),
        (
            "/orders/mock/ny-pharmacy-approval",
            make_ny_pharmacy_payload,
        ),
    ],
)
def test_mock_order_endpoints_return_ok_and_decision_shape(
    path: str, payload,
) -> None:
    """
    Ensure all mock order endpoints:
    - respond with HTTP 200
    - return a JSON body with a decision payload that includes a status and
      a reason/explanation string
    - optionally include a developer trace used by the console when
      AI / RAG debug is enabled.
    """

    body = payload() if callable(payload) else payload
    resp = client.post(path, json=body)
    assert resp.status_code == 200

    data = resp.json()

    decision = data.get("decision")

    assert isinstance(decision, dict), f"{path} decision should be an object"
    assert decision["status"] in ["ok_to_ship", "needs_review", "blocked"]
    assert isinstance(decision["reason"], str)
    assert decision["reason"].strip() != ""
    assert decision.get("risk_level") in {"low", "medium", "high", None}
    if decision.get("risk_level"):
        assert isinstance(decision.get("risk_score"), (int, float))
    assert "regulatory_references" in decision
    assert isinstance(decision["regulatory_references"], list)

    trace = data.get("developer_trace")
    if "developer_trace" in data:
        assert trace is None or isinstance(
            trace, dict
        ), f"{path} developer trace should be a dict when present"


def test_ohio_hospital_mock_order_has_expected_demo_status() -> None:
    """
    The Ohio hospital mock order is used in demos as the primary
    end-to-end example. This test makes its outcome explicit.
    """
    resp = client.get("/orders/mock/ohio-hospital-approval")
    assert resp.status_code == 200
    data = resp.json()

    decision = data.get("decision", {})

    assert decision["status"] == "ok_to_ship"
    assert decision.get("risk_level") == "low"
    assert isinstance(decision.get("risk_score"), (int, float))
    assert isinstance(decision["reason"], str)
    assert decision["reason"].strip() != ""
    assert "approved" in decision["reason"].lower()
    assert data.get("scenario_id") == "ohio-hospital-schedule-ii-happy-path"

    refs = decision.get("regulatory_references", [])
    assert isinstance(refs, list)
    if refs:
        assert "id" in refs[0]
        assert "label" in refs[0]


def test_ohio_hospital_mock_order_expired_license() -> None:
    resp = client.get("/orders/mock/ohio-hospital-expired-license")
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data
    decision = data["decision"]

    assert decision["status"] == "blocked"
    assert decision.get("risk_level") == "high"
    assert isinstance(decision.get("risk_score"), (int, float))

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    if refs:
        assert "id" in refs[0]
        assert "label" in refs[0]


def test_ohio_hospital_mock_order_wrong_state() -> None:
    resp = client.get("/orders/mock/ohio-hospital-wrong-state")
    assert resp.status_code == 200

    data = resp.json()
    assert "decision" in data
    decision = data["decision"]

    assert decision["status"] == "needs_review"
    assert decision.get("risk_level") == "medium"
    assert isinstance(decision.get("risk_score"), (int, float))

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    if refs:
        assert "id" in refs[0]
        assert "label" in refs[0]
