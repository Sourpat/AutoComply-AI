from tests.conftest import client


def test_ohio_tddd_explain_includes_regulatory_knowledge_sources() -> None:
    payload = {
        "facility_name": "Test Facility",
        "license_number": "TDDD-TEST-123",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "expiration_date": "2030-01-01",
        "attestation_accepted": True,
    }

    eval_resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert eval_resp.status_code == 200

    decision = eval_resp.json()["decision"]
    decision_summary = {
        "status": decision["status"],
        "reason": decision["reason"],
        "missing_fields": eval_resp.json().get("missing_fields") or [],
        "regulatory_references": [
            ref.get("id") for ref in decision.get("regulatory_references", [])
        ],
    }

    explain_resp = client.post(
        "/ohio-tddd/explain",
        json={"decision": decision_summary},
    )
    assert explain_resp.status_code == 200

    data = explain_resp.json()

    for key in [
        "status",
        "reason",
        "explanation",
        "regulatory_references",
        "rag_explanation",
        "artifacts_used",
        "rag_sources",
    ]:
        assert key in data, f"Expected key {key} in explain response"

    assert isinstance(data["rag_sources"], list)
    assert len(data["rag_sources"]) >= 1

    ids_from_sources = {src.get("id") for src in data["rag_sources"]}
    refs = set(data.get("regulatory_references") or [])
    artifacts = set(data.get("artifacts_used") or [])

    assert "ohio_tddd_rules" in ids_from_sources or "ohio_tddd_rules" in refs

    assert ids_from_sources.issuperset(refs) or refs.issuperset(ids_from_sources)
    assert ids_from_sources.issuperset(artifacts) or artifacts.issuperset(ids_from_sources)
