from tests.conftest import client


def test_practitioner_copilot_uses_regulatory_knowledge_search() -> None:
    payload = {
        "facility_name": "Example Clinic",
        "facility_type": "clinic",
        "practitioner_name": "Dr. Example",
        "dea_number": "DEA1234567",
        "npi_number": "1234567890",
        "state_license_number": "SLN12345",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "oxycodone",
                "name": "Oxycodone",
                "drug_name": "Oxycodone",
                "schedule": "II",
            }
        ],
    }

    resp = client.post("/csf/practitioner/form-copilot", json=payload)
    assert resp.status_code == 200

    data = resp.json()

    for key in [
        "status",
        "reason",
        "missing_fields",
        "regulatory_references",
        "rag_explanation",
        "artifacts_used",
        "rag_sources",
    ]:
        assert key in data, f"Expected key {key} in copilot response"

    assert isinstance(data["rag_sources"], list)
    assert len(data["rag_sources"]) >= 1

    ids_from_sources = {src.get("id") for src in data["rag_sources"]}
    refs = set(ref.get("id") if isinstance(ref, dict) else ref for ref in data.get("regulatory_references") or [])
    artifacts = set(data.get("artifacts_used") or [])

    assert "csf_practitioner_form" in ids_from_sources or "csf_practitioner_form" in refs

    assert ids_from_sources.issuperset(refs) or refs.issuperset(ids_from_sources)
    assert ids_from_sources.issuperset(artifacts) or artifacts.issuperset(ids_from_sources)
