import hashlib
import io
import json
import os
import tempfile
import zipfile
from pathlib import Path

from tests.conftest import client


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def test_audit_zip_includes_evidence_snapshot():
    with tempfile.TemporaryDirectory(prefix="audit-zip-evidence-") as temp_dir:
        os.environ["ATTACHMENTS_UPLOAD_DIR"] = str(Path(temp_dir))
        os.environ["ENV"] = "ci"

        submit_resp = client.post(
            "/api/submitter/submissions",
            json={
                "client_token": "audit-zip-evidence",
                "subject": "Audit zip evidence",
                "submitter_name": "Audit Tester",
                "jurisdiction": "OH",
                "doc_type": "csf_facility",
                "notes": "Audit zip",
            },
        )
        assert submit_resp.status_code == 200
        submission_id = submit_resp.json()["submission_id"]
        case_id = submit_resp.json()["verifier_case_id"]

        file_one = b"Evidence file one"
        file_two = b"Evidence file two"
        files = [
            ("evidence-1.txt", file_one),
            ("evidence-2.txt", file_two),
        ]

        for filename, payload in files:
            upload_resp = client.post(
                f"/api/submissions/{submission_id}/attachments",
                files={"file": (filename, io.BytesIO(payload), "text/plain")},
            )
            assert upload_resp.status_code == 200

        decision_resp = client.post(
            f"/api/verifier/cases/{case_id}/decision?include_explain=0",
            json={"type": "approve", "actor": "tester"},
        )
        assert decision_resp.status_code == 200

        final_resp = client.get(f"/api/verifier/cases/{case_id}/final-packet")
        assert final_resp.status_code == 200
        final_packet = final_resp.json()

        zip_resp = client.get(f"/api/verifier/cases/{case_id}/audit.zip?include_explain=0")
        assert zip_resp.status_code == 200

        buffer = io.BytesIO(zip_resp.content)
        with zipfile.ZipFile(buffer) as archive:
            names = set(archive.namelist())
            assert "decision_packet.json" in names
            assert "manifest.json" in names
            evidence_files = [name for name in names if name.startswith("evidence/")]
            assert len(evidence_files) == 2

            packet_bytes = archive.read("decision_packet.json")
            packet_data = json.loads(packet_bytes.decode("utf-8"))
            assert packet_data == final_packet

            manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            assert manifest["locked"] is True
            assert manifest["files"] and len(manifest["files"]) == 2
            assert manifest["packet_sha256"] == _sha256_bytes(packet_bytes)

            for item in manifest["files"]:
                payload = archive.read(item["path"])
                assert _sha256_bytes(payload) == item["sha256"]
