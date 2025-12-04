from starlette.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.scenario_builders import (
    make_ohio_hospital_csf_payload_expired_license,
    make_ohio_tddd_payload_expired_from_csf,
)

client = TestClient(app)


def test_ohio_hospital_schedule_ii_expired_license_flow() -> None:
    """
    End-to-end scenario (negative path):

    1) Ohio hospital fills CSF for a Schedule II drug (data is fine).
    2) AutoComply AI evaluates the Hospital CSF (should generally be ok_to_ship or needs_review, but not blocked due to license).
    3) Ohio TDDD license evaluate is run with an EXPIRED license -> BLOCKED + HIGH risk.
    4) Mock Ohio hospital order endpoint for this scenario should reflect BLOCKED + HIGH risk.

    Key expectations:
    - CSF is not the blocking factor.
    - Ohio TDDD decision is 'blocked' with 'high' risk.
    - Mock order decision is 'blocked' with 'high' risk and a clear reason.
    """

    csf_payload = make_ohio_hospital_csf_payload_expired_license()
    ohio_tddd_payload = make_ohio_tddd_payload_expired_from_csf(csf_payload)

    # --- Step 1: CSF evaluate (should NOT be the blocker here) ---
    csf_eval_resp = client.post("/csf/hospital/evaluate", json=csf_payload)
    assert csf_eval_resp.status_code == 200

    csf_eval_data = csf_eval_resp.json()
    assert csf_eval_data["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert "reason" in csf_eval_data
    assert "regulatory_references" in csf_eval_data

    # We explicitly do NOT require blocked here; CSF can be ok_to_ship or needs_review.
    assert csf_eval_data["status"] != "blocked"

    # --- Step 2: Ohio TDDD evaluate (expired license MUST block) ---
    ohio_tddd_resp = client.post(
        "/license/ohio-tddd/evaluate", json=ohio_tddd_payload
    )
    assert ohio_tddd_resp.status_code == 200

    ohio_tddd_data = ohio_tddd_resp.json()
    decision = ohio_tddd_data.get("decision", ohio_tddd_data)

    assert decision["status"] == "blocked"
    assert "expired" in decision["reason"].lower()

    assert decision.get("risk_level") == "high"
    assert isinstance(decision.get("risk_score"), (int, float))

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    assert refs
    ids = {ref["id"] for ref in refs}
    assert "ohio-tddd-core" in ids

    # --- Step 3: Mock order endpoint (expired license scenario) ---
    mock_resp = client.get("/orders/mock/ohio-hospital-expired-license")
    assert mock_resp.status_code == 200

    mock_data = mock_resp.json()
    assert "decision" in mock_data
    order_decision = mock_data["decision"]

    assert order_decision["status"] == "blocked"
    assert order_decision.get("risk_level") == "high"
    assert isinstance(order_decision.get("risk_score"), (int, float))

    assert "license" in order_decision["reason"].lower()
    assert "expired" in order_decision["reason"].lower()
