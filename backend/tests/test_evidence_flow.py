import io

from conftest import client
from app.workflow.repo import update_case
from app.workflow.models import CaseUpdateInput, CaseStatus


def _create_submission() -> tuple[str, str]:
    payload = {
        "decisionType": "csf_practitioner",
        "submittedBy": "submitter@example.com",
        "formData": {
            "name": "Dr. Evidence",
            "licenseNumber": "MD-2001",
        },
        "evaluatorOutput": {"decision": "NEEDS_REVIEW"},
    }
    resp = client.post("/submissions", json=payload)
    assert resp.status_code == 201
    submission = resp.json()
    submission_id = submission["id"]

    cases_resp = client.get("/workflow/cases?limit=100")
    assert cases_resp.status_code == 200
    cases = cases_resp.json()["items"]
    case = next((c for c in cases if c.get("submissionId") == submission_id), None)
    assert case is not None
    return submission_id, case["id"]


def test_evidence_upload_list_download_and_event():
    submission_id, case_id = _create_submission()

    file_bytes = b"%PDF-1.4\n%Evidence Test\n"
    files = {
        "file": ("test.pdf", io.BytesIO(file_bytes), "application/pdf"),
    }
    data = {
        "submission_id": submission_id,
        "uploaded_by": "submitter@example.com",
    }

    upload_resp = client.post(f"/workflow/cases/{case_id}/evidence", files=files, data=data)
    assert upload_resp.status_code == 200
    evidence = upload_resp.json()
    assert evidence["filename"] == "test.pdf"

    list_resp = client.get(f"/workflow/cases/{case_id}/evidence")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert len(items) == 1

    evidence_id = items[0]["id"]
    download_resp = client.get(f"/workflow/evidence/{evidence_id}/download")
    assert download_resp.status_code == 200
    assert download_resp.content == file_bytes
    assert "application/pdf" in download_resp.headers.get("content-type", "")

    events_resp = client.get(f"/workflow/cases/{case_id}/events")
    assert events_resp.status_code == 200
    events = events_resp.json()
    event_types = [e.get("eventType") for e in events]
    assert "evidence_uploaded" in event_types


def test_cancelled_case_blocks_upload():
    submission_id, case_id = _create_submission()
    update_case(case_id, CaseUpdateInput(status=CaseStatus.CANCELLED))

    files = {
        "file": ("test.png", io.BytesIO(b"\x89PNG\r\n"), "image/png"),
    }
    data = {
        "submission_id": submission_id,
    }

    resp = client.post(f"/workflow/cases/{case_id}/evidence", files=files, data=data)
    assert resp.status_code == 409
