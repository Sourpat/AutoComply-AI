from tests.conftest import client
from src.autocomply.domain.trace import TRACE_HEADER_NAME


def test_ny_pharmacy_wrong_state_flow() -> None:
    trace_id = "scenario-ny-wrong-state-001"

    license_payload = {
        "license_number": "NY-PHARM-OUT-OF-STATE",
        "license_type": "pharmacy",
        "ship_to_state": "NJ",
        "expiration_date": "2030-01-01",
    }

    headers = {TRACE_HEADER_NAME: trace_id}

    lic_resp = client.post(
        "/license/ny-pharmacy/evaluate", json=license_payload, headers=headers
    )
    assert lic_resp.status_code == 200
    lic_data = lic_resp.json()
    lic_decision = lic_data.get("decision", lic_data)
    assert lic_decision["status"] == "needs_review"
    assert lic_decision["risk_level"] == "medium"
    assert "state" in lic_decision["reason"].lower()

    order_resp = client.get(
        "/orders/mock/ny-pharmacy-wrong-state", headers=headers
    )
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_decision = order_data.get("decision", order_data)
    assert order_decision["status"] == "needs_review"
    assert order_decision["risk_level"] == "medium"
    assert "state" in order_decision["reason"].lower()
