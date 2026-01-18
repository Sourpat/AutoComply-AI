from tests.conftest import client


def test_case_decision_creates_events_and_updates_status():
    # Create a case
    create_resp = client.post(
        "/workflow/cases",
        json={
            "decisionType": "csf_practitioner",
            "title": "Decision API Test",
        },
    )
    assert create_resp.status_code in (200, 201)
    case_data = create_resp.json()
    case_id = case_data["id"]

    # Approve case
    decision_resp = client.post(
        f"/workflow/cases/{case_id}/decision",
        json={
            "decision": "APPROVED",
            "reason": "All requirements met",
            "decidedByRole": "verifier",
            "decidedByName": "unit@test",
        },
    )
    assert decision_resp.status_code == 200
    decision_data = decision_resp.json()
    assert decision_data["decision"] == "APPROVED"

    # Verify case status updated
    case_resp = client.get(f"/workflow/cases/{case_id}")
    assert case_resp.status_code == 200
    updated_case = case_resp.json()
    assert updated_case["status"] == "approved"
    assert updated_case.get("resolvedAt") is not None

    # Verify decision endpoint returns current decision
    get_decision_resp = client.get(f"/workflow/cases/{case_id}/decision")
    assert get_decision_resp.status_code == 200
    assert get_decision_resp.json()["decision"] == "APPROVED"

    # Verify case events include decision + status change
    events_resp = client.get(f"/workflow/cases/{case_id}/events")
    assert events_resp.status_code == 200
    events = events_resp.json()
    event_types = {event["eventType"] for event in events}
    assert "case_decision_created" in event_types
    assert "case_status_changed" in event_types
