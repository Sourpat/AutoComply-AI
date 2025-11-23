from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_rag_regulatory_explain_stub_with_known_artifacts():
    payload = {
        "question": "Explain why this practitioner CSF in Florida with Schedule II items goes to manual review.",
        "regulatory_references": [
            "csf_practitioner_form",
            "csf_fl_addendum",
        ],
        "decision": {
            "status": "manual_review",
            "reason": "CSF includes high-risk Schedule II controlled substances for ship-to state FL...",
        },
    }

    resp = client.post("/rag/regulatory-explain", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    answer = data["answer"]

    # In stub mode we expect a deterministic answer structure
    assert "RAG pipeline is not yet enabled" in answer
    assert "csf_practitioner_form" in answer
    assert "csf_fl_addendum" in answer

    # Echoed references
    assert data["regulatory_references"] == [
        "csf_practitioner_form",
        "csf_fl_addendum",
    ]

    # Artifacts used should at least include the same ids (if present in coverage)
    assert "csf_practitioner_form" in data["artifacts_used"]
    assert "csf_fl_addendum" in data["artifacts_used"]

    debug = data.get("debug", {})
    assert debug.get("mode") in ("stub", "rag")
