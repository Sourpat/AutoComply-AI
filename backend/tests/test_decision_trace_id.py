from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.trace import TRACE_HEADER_NAME


client = TestClient(app)


def test_hospital_csf_generates_trace_id_when_missing() -> None:
    payload = {
        "facility_name": "Test Hospital",
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

    resp = client.post("/csf/hospital/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert "trace_id" in data
    assert isinstance(data["trace_id"], str)
    assert data["trace_id"]


def test_trace_id_propagated_across_csf_and_license() -> None:
    """
    Simulate an orchestrator (e.g. n8n) that generates a trace ID and sends it
    to both CSF and license endpoints. Both decisions should echo the same ID.
    """

    trace_id = "test-trace-12345"

    csf_payload = {
        "facility_name": "Trace Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-TRACE2",
        "pharmacy_license_number": "LIC-TRACE2",
        "dea_number": "DEA-TRACE2",
        "pharmacist_in_charge_name": "Dr. Trace 2",
        "pharmacist_contact_phone": "555-TRACE2",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [],
    }

    ohio_tddd_payload = {
        "license_number": "TDDD-TRACE2",
        "license_type": "ohio_tddd",
        "ship_to_state": "OH",
        "expiration_date": "2030-01-01",
        "facility_name": "Trace Hospital",
        "account_number": "ACC-TRACE2",
        "attestation_accepted": True,
    }

    headers = {TRACE_HEADER_NAME: trace_id}

    csf_resp = client.post("/csf/hospital/evaluate", json=csf_payload, headers=headers)
    assert csf_resp.status_code == 200
    csf_data = csf_resp.json()
    assert csf_data.get("trace_id") == trace_id

    oh_resp = client.post(
        "/license/ohio-tddd/evaluate", json=ohio_tddd_payload, headers=headers
    )
    assert oh_resp.status_code == 200
    oh_data = oh_resp.json()
    decision = oh_data.get("decision", oh_data)

    assert decision.get("trace_id") == trace_id
