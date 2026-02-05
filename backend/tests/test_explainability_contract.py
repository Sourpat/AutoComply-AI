from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_explain_contract_v1_approved_practitioner():
    payload = {
        "submission_type": "csf_practitioner",
        "payload": {
            "id": "sub-001",
            "form": {
                "dea_number": "AB1234567",
                "dea_expiration": "2026-01-01",
                "state_license_number": "SL-123",
                "state_license_expiration": "2026-01-01",
                "state": "OH",
                "requested_schedules": ["II", "III"],
            },
        },
    }

    resp = client.post("/api/rag/explain/v1", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "approved"
    assert data["risk"] == "low"
    assert data["missing_fields"] == []
    assert data["fired_rules"] == []
    assert data["submission_id"] == "sub-001"
    assert data["policy_version"].startswith("explainability-policy-")


def test_explain_contract_v1_blocked_hospital_ohio():
    payload = {
        "submission_type": "csf_hospital_ohio",
        "submission_id": "sub-002",
        "payload": {
            "form": {
                "state": "OH",
                "authorized_schedules": ["II"],
                "attestation_complete": "yes",
                "tddd_expiration": "2025-05-01",
            }
        },
    }

    resp = client.post("/api/rag/explain/v1", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["status"] == "blocked"
    assert data["risk"] == "high"

    missing_keys = {field["key"] for field in data["missing_fields"]}
    assert "tddd_cert" in missing_keys

    fired_rule_ids = {rule["id"] for rule in data["fired_rules"]}
    assert "OH_TDDD_REQUIRED" in fired_rule_ids
    assert data["submission_id"] == "sub-002"
    assert isinstance(data.get("citations"), list)
    if data["citations"]:
        sample = data["citations"][0]
        assert "doc_id" in sample
        assert "chunk_id" in sample
        assert "snippet" in sample


def test_explain_contract_v1_truth_gate_when_no_citations():
    payload = {
        "submission_type": "csf_hospital_ohio",
        "submission_id": "sub-003",
        "payload": {
            "form": {
                "state": "ZZ",
                "authorized_schedules": ["II"],
                "attestation_complete": "yes",
                "tddd_expiration": "2025-05-01",
            }
        },
    }

    resp = client.post("/api/rag/explain/v1", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["fired_rules"], "Expected fired rules for TDDD certificate"
    assert data["citations"] == []
    assert "no_supporting_evidence_found" in data.get("debug", {}).get("note", "")

    summary = data["summary"].lower()
    assert "blocking rule triggered" in summary
    assert "must" not in summary
