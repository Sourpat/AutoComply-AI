import os

from fastapi.testclient import TestClient

from src.api.main import app
from src.autocomply.domain.submissions_store import reset_submission_store

client = TestClient(app)


def test_submitter_to_verifier_flow(monkeypatch) -> None:
    monkeypatch.setenv("ENV", "ci")
    monkeypatch.setenv("APP_ENV", "dev")
    reset_submission_store()
    client.post("/api/ops/seed-verifier-cases")

    payload = {
        "client_token": "test-token-1",
        "subject": "Test submission",
        "submitter_name": "Tester",
        "jurisdiction": "OH",
        "doc_type": "csf_facility",
        "notes": "Test notes",
        "attachments": [{"name": "doc.pdf", "content_type": "application/pdf", "size_bytes": 100}],
    }

    resp = client.post("/api/submitter/submissions", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["submission_id"]
    assert data["verifier_case_id"]

    list_resp = client.get("/api/verifier/cases")
    assert list_resp.status_code == 200
    items = list_resp.json()["items"]
    assert any(item["case_id"] == data["verifier_case_id"] for item in items)

    detail_resp = client.get(f"/api/verifier/cases/{data['verifier_case_id']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["case"]["submission_id"] == data["submission_id"]
    assert detail["case"]["submission_summary"] is not None

    submission_resp = client.get(f"/api/verifier/cases/{data['verifier_case_id']}/submission")
    assert submission_resp.status_code == 200
    submission_data = submission_resp.json()
    assert submission_data["submission_id"] == data["submission_id"]

    second_resp = client.post("/api/submitter/submissions", json=payload)
    assert second_resp.status_code == 200
    second_data = second_resp.json()
    assert second_data["submission_id"] == data["submission_id"]
    assert second_data["verifier_case_id"] == data["verifier_case_id"]

    list_resp_after = client.get("/api/verifier/cases")
    items_after = list_resp_after.json()["items"]
    assert len([item for item in items_after if item["case_id"] == data["verifier_case_id"]]) == 1
