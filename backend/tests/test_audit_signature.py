from starlette.testclient import TestClient

from app.audit.hash import compute_packet_hash, compute_packet_signature
from src.api.main import app
from src.config import get_settings


client = TestClient(app)


def _base_packet():
    return {
        "metadata": {
            "caseId": "CASE-1",
            "decisionId": "DECISION-1",
            "generatedAt": "2026-02-02T00:00:00Z",
        },
        "caseSnapshot": {
            "submissionId": "CASE-1",
            "tenant": "demo",
            "formType": "csf",
            "status": "submitted",
            "riskLevel": "low",
            "createdAt": "2026-02-02T00:00:00Z",
            "updatedAt": "2026-02-02T00:00:00Z",
            "title": "Audit Packet",
            "subtitle": "Test",
            "summary": "Test summary",
            "traceId": "trace-1",
        },
        "decision": {
            "status": "submitted",
            "confidence": 0.5,
            "riskLevel": "low",
            "decisionId": "DECISION-1",
            "updatedAt": "2026-02-02T00:00:00Z",
        },
        "explainability": {
            "summary": "Test summary",
            "traceId": "trace-1",
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


def test_audit_signature_verify_round_trip(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("AUDIT_SIGNING_KEY", "test-signing-key")

    packet = _base_packet()
    packet_hash = compute_packet_hash(packet)
    signature = compute_packet_signature(packet, "test-signing-key")

    packet["packetHash"] = packet_hash
    packet["packet_signature"] = signature
    packet["signature_alg"] = "HMAC-SHA256"

    response = client.post("/api/audit/verify", json=packet)
    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is True
    get_settings.cache_clear()


def test_audit_signature_verify_detects_tampering(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("AUDIT_SIGNING_KEY", "test-signing-key")

    packet = _base_packet()
    packet_hash = compute_packet_hash(packet)
    signature = compute_packet_signature(packet, "test-signing-key")

    packet["packetHash"] = packet_hash
    packet["packet_signature"] = signature
    packet["signature_alg"] = "HMAC-SHA256"

    packet["decision"]["status"] = "blocked"

    response = client.post("/api/audit/verify", json=packet)
    assert response.status_code == 200
    payload = response.json()
    assert payload["valid"] is False
    assert payload["reason"] in {"hash_mismatch", "signature_mismatch"}
    get_settings.cache_clear()
