from tests.conftest import client
from src.autocomply.domain.trace import TRACE_HEADER_NAME


def test_ny_pharmacy_expired_license_flow() -> None:
    trace_id = "scenario-ny-expired-001"

    license_payload = {
        "license_number": "NY-PHARM-EXPIRED",
        "license_type": "pharmacy",
        "ship_to_state": "NY",
        "expiration_date": "2020-01-01",
    }

    headers = {TRACE_HEADER_NAME: trace_id}

    lic_resp = client.post(
        "/license/ny-pharmacy/evaluate", json=license_payload, headers=headers
    )
    assert lic_resp.status_code == 200
    lic_data = lic_resp.json()
    lic_decision = lic_data.get("decision", lic_data)
    assert lic_decision["status"] == "blocked"
    assert lic_decision["risk_level"] == "high"
    assert "expired" in lic_decision["reason"].lower()

    order_resp = client.get(
        "/orders/mock/ny-pharmacy-expired-license", headers=headers
    )
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_decision = order_data.get("decision", order_data)
    assert order_decision["status"] == "blocked"
    assert order_decision["risk_level"] == "high"
    assert "expired" in order_decision["reason"].lower()
