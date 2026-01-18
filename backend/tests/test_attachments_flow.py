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
