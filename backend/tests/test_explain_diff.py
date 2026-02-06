from __future__ import annotations

from src.autocomply.domain.explainability.store import diff_explain_runs


def test_diff_detects_changes():
    run_a = {
        "run_id": "run-a",
        "submission_hash": "hash-1",
        "policy_version": "policy-v1",
        "knowledge_version": "kb-v1",
        "status": "approved",
        "risk": "low",
        "created_at": "2026-02-05T00:00:00Z",
        "payload": {
            "missing_fields": [],
            "fired_rules": [],
            "citations": [],
            "debug": {"evidence": {"evidence_coverage": 0.0}, "retrieval": {"unique_docs": 0}},
        },
    }
    run_b = {
        "run_id": "run-b",
        "submission_hash": "hash-2",
        "policy_version": "policy-v1",
        "knowledge_version": "kb-v1",
        "status": "blocked",
        "risk": "high",
        "created_at": "2026-02-05T00:01:00Z",
        "payload": {
            "missing_fields": [{"key": "tddd_cert", "category": "BLOCK"}],
            "fired_rules": [{"id": "OH_TDDD_REQUIRED"}],
            "citations": [{"doc_id": "doc-1", "chunk_id": "chunk-1"}],
            "debug": {"evidence": {"evidence_coverage": 1.0}, "retrieval": {"unique_docs": 1}},
        },
    }

    diff = diff_explain_runs(run_a, run_b)
    changes = diff["changes"]

    assert changes["status"]["changed"] is True
    assert changes["risk"]["changed"] is True
    assert changes["submission_hash"]["changed"] is True
    assert "policy_version" in changes["versions"]
    assert "knowledge_version" in changes["versions"]
    assert "evidence_coverage" in changes["debug"]
    assert "unique_docs" in changes["debug"]
    assert "OH_TDDD_REQUIRED" in changes["fired_rules"]["added"]
    assert "tddd_cert:BLOCK" in changes["missing_fields"]["added"]
    assert "doc-1:chunk-1" in changes["citations"]["added"]
