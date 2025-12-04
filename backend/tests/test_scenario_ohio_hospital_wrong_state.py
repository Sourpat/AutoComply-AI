from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.scenario_builders import (
    make_ohio_hospital_csf_payload_wrong_state,
    make_ohio_tddd_payload_wrong_state_from_csf,
)

client = TestClient(app)


def test_ohio_hospital_schedule_ii_wrong_state_flow() -> None:
    """
    End-to-end scenario (review path):

    1) Ohio hospital fills CSF for a Schedule II drug but ship_to_state is NOT Ohio.
    2) CSF evaluate should not be the blocking factor (can be ok_to_ship or needs_review).
    3) Ohio TDDD license evaluate must return 'needs_review' (not ok_to_ship/blocked),
       with 'medium' risk and clear reason.
    4) Mock order endpoint for this scenario should reflect 'needs_review' + medium risk.
    """

    csf_payload = make_ohio_hospital_csf_payload_wrong_state()
    ohio_tddd_payload = make_ohio_tddd_payload_wrong_state_from_csf(csf_payload)

    # Step 1: CSF evaluate
    csf_eval_resp = client.post("/csf/hospital/evaluate", json=csf_payload)
    assert csf_eval_resp.status_code == 200

    csf_eval_data = csf_eval_resp.json()
    assert csf_eval_data["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert "reason" in csf_eval_data

    # We explicitly do NOT require blocked here; CSF is not the main issue.
    assert csf_eval_data["status"] != "blocked"

    # Step 2: Ohio TDDD evaluate (wrong state => needs_review)
    ohio_tddd_resp = client.post("/license/ohio-tddd/evaluate", json=ohio_tddd_payload)
    assert ohio_tddd_resp.status_code == 200

    ohio_tddd_data = ohio_tddd_resp.json()
    decision = ohio_tddd_data.get("decision", ohio_tddd_data)

    assert decision["status"] == "needs_review"
    assert "state" in decision["reason"].lower()
    assert decision.get("risk_level") == "medium"
    assert isinstance(decision.get("risk_score"), (int, float))

    refs = decision["regulatory_references"]
    assert isinstance(refs, list)
    assert refs

    # Step 3: Mock order endpoint
    mock_resp = client.get("/orders/mock/ohio-hospital-wrong-state")
    assert mock_resp.status_code == 200

    mock_data = mock_resp.json()
    assert "decision" in mock_data
    order_decision = mock_data["decision"]

    assert order_decision["status"] == "needs_review"
    assert order_decision.get("risk_level") == "medium"
    assert isinstance(order_decision.get("risk_score"), (int, float))
    assert "state" in order_decision["reason"].lower()
