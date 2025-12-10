from tests.conftest import client


def test_ny_pharmacy_evaluate_includes_regulatory_knowledge_sources() -> None:
    payload = {
        "license_number": "NY-PHARM-TEST-123",
        "ny_state_license_number": "NY-PHARM-TEST-123",
        "license_type": "pharmacy",
        "ship_to_state": "NY",
        "expiration_date": "2030-01-01",
        "attestation_accepted": True,
    }

    resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()

    for key in [
        "status",
        "reason",
        "regulatory_references",
        "artifacts_used",
        "rag_sources",
    ]:
        assert key in data, f"Expected key {key} in NY Pharmacy response"

    assert isinstance(data["rag_sources"], list)
    assert len(data["rag_sources"]) >= 1

    ids_from_sources = {src.get("id") for src in data["rag_sources"]}
    refs = set(data.get("regulatory_references") or [])
    artifacts = set(data.get("artifacts_used") or [])

    assert "ny_pharmacy_core" in ids_from_sources or "ny_pharmacy_core" in refs

    assert ids_from_sources.issuperset(refs) or refs.issuperset(ids_from_sources)
    assert ids_from_sources.issuperset(artifacts) or artifacts.issuperset(ids_from_sources)
