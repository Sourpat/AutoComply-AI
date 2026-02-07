import os

from tests.conftest import client


def test_submission_status_flow() -> None:
    os.environ["ENV"] = "ci"

    submit_resp = client.post(
        "/api/submitter/submissions",
        json={
            "client_token": "status-flow-1",
            "subject": "Status Flow",
            "submitter_name": "Status Tester",
            "jurisdiction": "OH",
            "doc_type": "csf_facility",
            "notes": "status flow",
        },
    )
    assert submit_resp.status_code == 200
    submission_id = submit_resp.json()["submission_id"]
    case_id = submit_resp.json()["verifier_case_id"]

    detail_resp = client.get(f"/api/submitter/submissions/{submission_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "submitted"

    open_resp = client.get(f"/api/verifier/cases/{case_id}")
    assert open_resp.status_code == 200
    assert open_resp.json()["case"]["submission_status"] == "in_review"

    request_resp = client.post(
        f"/api/verifier/cases/{case_id}/decision",
        json={"type": "request_info", "reason": "Need more docs", "actor": "verifier"},
    )
    assert request_resp.status_code == 200

    detail_resp = client.get(f"/api/submitter/submissions/{submission_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["status"] == "needs_info"
    assert detail_resp.json()["request_info"]["message"] == "Need more docs"

    respond_resp = client.post(
        f"/api/submitter/submissions/{submission_id}/respond",
        json={"message": "Uploading docs"},
    )
    assert respond_resp.status_code == 200
    assert respond_resp.json()["status"] == "submitted"

    approve_resp = client.post(
        f"/api/verifier/cases/{case_id}/decision",
        json={"type": "approve", "actor": "verifier"},
    )
    assert approve_resp.status_code == 200
    final_detail = client.get(f"/api/submitter/submissions/{submission_id}")
    assert final_detail.status_code == 200
    assert final_detail.json()["status"] == "approved"

    submit_reject = client.post(
        "/api/submitter/submissions",
        json={
            "client_token": "status-flow-2",
            "subject": "Reject Flow",
            "submitter_name": "Status Tester",
            "jurisdiction": "OH",
            "doc_type": "csf_facility",
            "notes": "status flow",
        },
    )
    assert submit_reject.status_code == 200
    submission_id_2 = submit_reject.json()["submission_id"]
    case_id_2 = submit_reject.json()["verifier_case_id"]

    client.get(f"/api/verifier/cases/{case_id_2}")
    reject_resp = client.post(
        f"/api/verifier/cases/{case_id_2}/decision",
        json={"type": "reject", "reason": "Rejected", "actor": "verifier"},
    )
    assert reject_resp.status_code == 200
    rejected_detail = client.get(f"/api/submitter/submissions/{submission_id_2}")
    assert rejected_detail.status_code == 200
    assert rejected_detail.json()["status"] == "rejected"

    list_resp = client.get("/api/submitter/submissions?limit=10")
    assert list_resp.status_code == 200
    assert any(item["submission_id"] == submission_id for item in list_resp.json())

    verifier_list = client.get("/api/verifier/cases?limit=10")
    assert verifier_list.status_code == 200
    assert any(
        item.get("submission_status") in {"approved", "rejected", "in_review", "submitted", "needs_info"}
        for item in verifier_list.json().get("items", [])
    )
