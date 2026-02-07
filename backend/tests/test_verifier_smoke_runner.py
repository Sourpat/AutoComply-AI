import os

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_verifier_smoke_runner_ok(monkeypatch) -> None:
    monkeypatch.setenv("ENV", "ci")
    monkeypatch.setenv("APP_ENV", "dev")

    response = client.get("/api/ops/verifier-smoke/run")
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True

    steps = payload.get("steps", [])
    assert steps
    assert all(step.get("ok") is True for step in steps)

    pdf_step = next(step for step in steps if step.get("name") == "packet_pdf")
    assert pdf_step["detail"]["content_type"] == "application/pdf"
    assert pdf_step["detail"]["bytes"] > 100

    zip_step = next(step for step in steps if step.get("name") == "audit_zip")
    assert zip_step["detail"]["content_type"] == "application/zip"
    assert zip_step["detail"]["bytes"] > 100
