from starlette.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.trace import TRACE_HEADER_NAME


client = TestClient(app)


def test_ohio_hospital_wrong_state_flow() -> None:
    trace_id = "scenario-ohio-wrong-state"

    csf_payload = {
        "facility_name": "Scenario Hospital – Wrong State",
        "facility_type": "hospital",
        "account_number": "ACC-OH-STATE",
        "pharmacy_license_number": "LIC-OH-STATE",
        "dea_number": "DEA-OH-STATE",
        "pharmacist_in_charge_name": "Dr. State",
        "pharmacist_contact_phone": "555-3000",
        "ship_to_state": "PA",
        "attestation_accepted": True,
        "controlled_substances": [],
    }

    ohio_tddd_payload = {
        "license_number": "TDDD-OH-STATE",
        "license_type": "TDDD",
        "facility_name": "Scenario Hospital – Wrong State",
        "account_number": "ACC-OH-STATE",
        "ship_to_state": "PA",
        "expiration_date": "2030-01-01",
        "attestation_accepted": True,
    }

    headers = {TRACE_HEADER_NAME: trace_id}

    csf_resp = client.post("/csf/hospital/evaluate", json=csf_payload, headers=headers)
    assert csf_resp.status_code == 200

    lic_resp = client.post("/license/ohio-tddd/evaluate", json=ohio_tddd_payload, headers=headers)
    assert lic_resp.status_code == 200
    lic_data = lic_resp.json()
    lic_decision = lic_data.get("decision", lic_data)
    assert lic_decision["status"] == "needs_review"
    assert lic_decision["risk_level"] == "medium"
    assert "state" in lic_decision["reason"].lower()

    order_resp = client.get("/orders/mock/ohio-hospital-wrong-state", headers=headers)
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_decision = order_data.get("decision", order_data)
    assert order_decision["status"] == "needs_review"
    assert order_decision["risk_level"] == "medium"
    assert "state" in order_decision["reason"].lower()
