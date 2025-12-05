from starlette.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.trace import TRACE_HEADER_NAME


client = TestClient(app)


def test_decision_audit_returns_full_ohio_hospital_journey() -> None:
    trace_id = "test-trace-ohio-journey-123"

    csf_payload = {
        "facility_name": "Trace Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-TRACE",
        "pharmacy_license_number": "LIC-TRACE",
        "dea_number": "DEA-TRACE",
        "pharmacist_in_charge_name": "Dr. Trace",
        "pharmacist_contact_phone": "555-TRACE",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [],
    }

    ohio_tddd_payload = {
        "tddd_number": "TDDD-TRACE",
        "facility_name": "Trace Hospital",
        "account_number": "ACC-TRACE",
        "license_type": "ohio_tddd",
        "ship_to_state": "OH",
        "expiration_date": "2030-01-01",
        "attestation_accepted": True,
    }

    headers = {TRACE_HEADER_NAME: trace_id}

    csf_resp = client.post("/csf/hospital/evaluate", json=csf_payload, headers=headers)
    assert csf_resp.status_code == 200

    lic_resp = client.post(
        "/license/ohio-tddd/evaluate", json=ohio_tddd_payload, headers=headers
    )
    assert lic_resp.status_code == 200

    order_resp = client.get("/orders/mock/ohio-hospital-approval", headers=headers)
    assert order_resp.status_code == 200

    audit_resp = client.get(f"/decisions/trace/{trace_id}")
    assert audit_resp.status_code == 200

    entries = audit_resp.json()
    assert isinstance(entries, list)
    assert len(entries) >= 3

    families = [e["engine_family"] for e in entries]
    decision_types = [e["decision_type"] for e in entries]

    assert "csf" in families
    assert "license" in families
    assert "order" in families

    assert any(dt == "csf_hospital" for dt in decision_types)
    assert any(dt == "license_ohio_tddd" for dt in decision_types)
    assert any("order_ohio_hospital_mock" in dt for dt in decision_types)


def test_decision_audit_unknown_trace_returns_empty_list() -> None:
    resp = client.get("/decisions/trace/unknown-trace-id-999")
    assert resp.status_code == 200
    assert resp.json() == []
