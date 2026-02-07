import io
import os
import tempfile
from pathlib import Path

from tests.conftest import client


def test_attachments_upload_list_download_roundtrip():
    with tempfile.TemporaryDirectory(prefix="attachments-test-") as temp_dir:
        os.environ["ATTACHMENTS_UPLOAD_DIR"] = str(Path(temp_dir))

        # Create a case
        create_resp = client.post(
            "/workflow/cases",
            json={
                "decisionType": "csf_practitioner",
                "title": "Attachments Flow Test",
            },
        )
        assert create_resp.status_code in (200, 201)
        case_id = create_resp.json()["id"]

        file_bytes = b"%PDF-1.4\n%Attachment Test\n"
        files = {
            "file": ("test.pdf", io.BytesIO(file_bytes), "application/pdf"),
        }
        data = {
            "uploaded_by": "submitter@example.com",
            "description": "Test attachment",
        }

        upload_resp = client.post(f"/workflow/cases/{case_id}/attachments", files=files, data=data)
        assert upload_resp.status_code == 200
        attachment = upload_resp.json()
        assert attachment["filename"] == "test.pdf"
        attachment_id = attachment["id"]

        list_resp = client.get(f"/workflow/cases/{case_id}/attachments")
        assert list_resp.status_code == 200
        items = list_resp.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == attachment_id

        download_resp = client.get(f"/workflow/cases/{case_id}/attachments/{attachment_id}/download")
        assert download_resp.status_code == 200
        assert download_resp.content == file_bytes

        events_resp = client.get(f"/workflow/cases/{case_id}/events")
        assert events_resp.status_code == 200
        event_types = {event["eventType"] for event in events_resp.json()}
        assert "attachment_added" in event_types


def test_submitter_attachment_flow_links_to_verifier_packet():
    with tempfile.TemporaryDirectory(prefix="submitter-attachments-") as temp_dir:
        os.environ["ATTACHMENTS_UPLOAD_DIR"] = str(Path(temp_dir))
        os.environ["ENV"] = "ci"

        submission_payload = {
            "subject": "Attachment Submission",
            "submitter_name": "Attachment Tester",
            "jurisdiction": "OH",
            "doc_type": "csf_facility",
            "notes": "Attachment flow",
            "client_token": "attachment-token",
        }
        submit_resp = client.post("/api/submitter/submissions", json=submission_payload)
        assert submit_resp.status_code == 200
        submission_id = submit_resp.json()["submission_id"]
        case_id = submit_resp.json()["verifier_case_id"]

        file_bytes = b"Test attachment content"
        files = {
            "file": ("evidence.txt", io.BytesIO(file_bytes), "text/plain"),
        }
        upload_resp = client.post(f"/api/submissions/{submission_id}/attachments", files=files)
        assert upload_resp.status_code == 200
        attachment = upload_resp.json()
        attachment_id = attachment["attachment_id"]

        list_resp = client.get(f"/api/submissions/{submission_id}/attachments")
        assert list_resp.status_code == 200
        items = list_resp.json()
        assert len(items) == 1
        assert items[0]["attachment_id"] == attachment_id

        verifier_list = client.get(f"/api/verifier/cases/{case_id}/attachments")
        assert verifier_list.status_code == 200
        verifier_items = verifier_list.json()
        assert len(verifier_items) == 1
        assert verifier_items[0]["attachment_id"] == attachment_id

        download_resp = client.get(f"/api/verifier/attachments/{attachment_id}/download")
        assert download_resp.status_code == 200
        assert download_resp.content == file_bytes

        packet_resp = client.get(f"/api/verifier/cases/{case_id}/packet")
        assert packet_resp.status_code == 200
        packet = packet_resp.json()
        packet_attachments = packet["evidence"]["attachments"]
        assert packet_attachments
        assert packet_attachments[0]["id"] == attachment_id
        assert packet_attachments[0]["filename"] == "evidence.txt"
