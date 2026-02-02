from starlette.testclient import TestClient

from src.api.main import app
from src.config import get_settings


client = TestClient(app)


def _base_packet():
    return {
        "metadata": {
            "caseId": "CASE-STATUS-1",
            "decisionId": "DECISION-STATUS-1",
            "generatedAt": "2026-02-02T00:00:00Z",
        },
        "caseSnapshot": {
            "submissionId": "CASE-STATUS-1",
            "tenant": "demo",
            "formType": "csf",
            "status": "submitted",
            "riskLevel": "low",
            "createdAt": "2026-02-02T00:00:00Z",
            "updatedAt": "2026-02-02T00:00:00Z",
            "title": "Audit Packet",
            "subtitle": "Test",
            "summary": "Test summary",
            "traceId": "trace-status-1",
        },
        "decision": {
            "status": "submitted",
            "confidence": 0.5,
            "riskLevel": "low",
            "decisionId": "DECISION-STATUS-1",
            "updatedAt": "2026-02-02T00:00:00Z",
        },
        "explainability": {
            "summary": "Test summary",
            "traceId": "trace-status-1",
            "timestamp": "2026-02-02T00:00:00Z",
            "rulesEvaluated": [],
            "modelNotes": [],
        },
        "timelineEvents": [],
        "evidenceIndex": [],
        "humanActions": {
            "auditNotes": "",
            "evidenceNotes": {},
            "events": [],
        },
        "packetVersion": "v1",
    }


def test_signing_status_prod_requires_key(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("AUDIT_SIGNING_KEY", raising=False)

    status = client.get("/api/audit/signing/status")
    assert status.status_code == 200
    payload = status.json()
    assert payload["enabled"] is False
    assert payload["key_present"] is False

    verify = client.post("/api/audit/verify", json=_base_packet())
    assert verify.status_code == 400
    assert "AUDIT_SIGNING_KEY" in verify.json().get("detail", "")
    get_settings.cache_clear()
