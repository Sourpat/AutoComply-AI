from datetime import datetime

from conftest import client


def _parse_iso(value: str) -> datetime:
    """Parse ISO timestamp string."""
    if value.endswith("Z"):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    return datetime.fromisoformat(value)


def test_request_info_creates_events_and_resubmit() -> None:
    # Create a submission (auto-creates case)
    payload = {
        "decisionType": "csf_practitioner",
        "submittedBy": "submitter@example.com",
        "formData": {
            "name": "Dr. Test Submitter",
            "licenseNumber": "MD-0001",
        },
        "evaluatorOutput": {
            "decision": "NEEDS_REVIEW",
        },
    }

    submission_resp = client.post("/submissions", json=payload)
    assert submission_resp.status_code == 201
    submission = submission_resp.json()
    submission_id = submission["id"]

    # Find linked case
    cases_resp = client.get("/workflow/cases?limit=100")
    assert cases_resp.status_code == 200
    cases = cases_resp.json()["items"]
    case = next((c for c in cases if c.get("submissionId") == submission_id), None)
    assert case is not None
    case_id = case["id"]

    # Request info
    request_resp = client.post(
        f"/workflow/cases/{case_id}/request-info",
        json={"message": "Please provide updated documentation", "requiredFields": ["licenseScan"]},
    )
    assert request_resp.status_code == 200
    request_payload = request_resp.json()
    assert request_payload["case"]["status"] == "needs_info"
    assert request_payload["request"]["status"] == "open"

    # Resubmit
    resubmit_resp = client.post(
        f"/workflow/cases/{case_id}/resubmit",
        json={"submissionId": submission_id, "note": "Added requested data"},
    )
    assert resubmit_resp.status_code == 200
    assert resubmit_resp.json()["status"] == "in_review"

    # Verify events
    events_resp = client.get(f"/workflow/cases/{case_id}/events")
    assert events_resp.status_code == 200
    events = events_resp.json()
    assert isinstance(events, list)

    event_types = [
        e.get("eventType") or e.get("event_type")
        for e in events
    ]

    assert "request_info_created" in event_types
    assert "request_info_resubmitted" in event_types

    # Verify ISO timestamps
    for event in events:
        created_at = event.get("createdAt") or event.get("created_at")
        assert isinstance(created_at, str)
        _parse_iso(created_at)
