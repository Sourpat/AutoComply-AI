from tests.conftest import client
from src.autocomply.domain.trace import TRACE_HEADER_NAME


def test_ny_pharmacy_happy_path_flow() -> None:
    trace_id = "scenario-ny-happy-001"

    license_payload = {
        "license_number": "NY-PHARM-HAPPY",
        "license_type": "pharmacy",
        "ship_to_state": "NY",
        "expiration_date": "2030-01-01",
    }

    headers = {TRACE_HEADER_NAME: trace_id}

    lic_resp = client.post(
        "/license/ny-pharmacy/evaluate", json=license_payload, headers=headers
    )
    assert lic_resp.status_code == 200
    lic_data = lic_resp.json()
    lic_decision = lic_data.get("decision", lic_data)
    assert lic_decision["status"] == "ok_to_ship"
    assert lic_decision["risk_level"] == "low"

    order_resp = client.get("/orders/mock/ny-pharmacy-approval", headers=headers)
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_decision = order_data.get("decision", order_data)
    assert order_decision["status"] == "ok_to_ship"
    assert order_decision["risk_level"] == "low"
