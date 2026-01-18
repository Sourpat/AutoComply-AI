import io
import os
import tempfile
from pathlib import Path

from tests.conftest import client


def _create_case():
    resp = client.post(
        "/workflow/cases",
        json={"decisionType": "csf_practitioner", "title": "Attachment Lifecycle"},
    )
    assert resp.status_code in (200, 201)
    return resp.json()["id"]


def test_attachment_delete_and_redact_lifecycle():
    with tempfile.TemporaryDirectory(prefix="attachments-lifecycle-") as temp_dir:
        os.environ["ATTACHMENTS_UPLOAD_DIR"] = str(Path(temp_dir))

        case_id = _create_case()

        # Upload 1 and redact
        file_bytes = b"%PDF-1.4\n%Redact Test\n"
        files = {"file": ("redact.pdf", io.BytesIO(file_bytes), "application/pdf")}
        upload_resp = client.post(
            f"/workflow/cases/{case_id}/attachments",
            files=files,
            data={"uploaded_by": "verifier@example.com"},
        )
        assert upload_resp.status_code == 200
        redacted_id = upload_resp.json()["id"]

        redact_resp = client.post(
            f"/workflow/cases/{case_id}/attachments/{redacted_id}/redact",
            json={"reason": "Contains sensitive data"},
        )
        assert redact_resp.status_code == 200

        download_redacted = client.get(
            f"/workflow/cases/{case_id}/attachments/{redacted_id}/download"
        )
        assert download_redacted.status_code == 451

        list_resp = client.get(f"/workflow/cases/{case_id}/attachments")
        assert list_resp.status_code == 200
        listed = list_resp.json()["items"]
        assert any(item["id"] == redacted_id and item["isRedacted"] == 1 for item in listed)

        # Upload 2 and delete
        file_bytes_2 = b"%PDF-1.4\n%Delete Test\n"
        files_2 = {"file": ("delete.pdf", io.BytesIO(file_bytes_2), "application/pdf")}
        upload_resp_2 = client.post(
            f"/workflow/cases/{case_id}/attachments",
            files=files_2,
            data={"uploaded_by": "verifier@example.com"},
        )
        assert upload_resp_2.status_code == 200
        deleted_id = upload_resp_2.json()["id"]

        delete_resp = client.request(
            "DELETE",
            f"/workflow/cases/{case_id}/attachments/{deleted_id}",
            json={"reason": "No longer needed"},
        )
        assert delete_resp.status_code == 200

        list_after_delete = client.get(f"/workflow/cases/{case_id}/attachments")
        assert list_after_delete.status_code == 200
        listed_after_delete = list_after_delete.json()["items"]
        assert all(item["id"] != deleted_id for item in listed_after_delete)

        download_deleted = client.get(
            f"/workflow/cases/{case_id}/attachments/{deleted_id}/download"
        )
        assert download_deleted.status_code == 410

        # Events
        events_resp = client.get(f"/workflow/cases/{case_id}/events")
        assert events_resp.status_code == 200
        event_types = {event["eventType"] for event in events_resp.json()}
        assert "attachment_removed" in event_types
        assert "attachment_redacted" in event_types

        # Audit events
        audit_resp = client.get(f"/workflow/cases/{case_id}/audit")
        assert audit_resp.status_code == 200
        audit_types = {event["eventType"] for event in audit_resp.json()["items"]}
        assert "evidence_removed" in audit_types
        assert "evidence_redacted" in audit_types
