from typing import Any, Dict

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def _extract_decision(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize decision shape so tests can handle both:
    - { "status": "...", "reason": "...", ... }
    - { "decision": { "status": "...", "reason": "...", ... } }
    """
    if "decision" in data and isinstance(data["decision"], dict):
        return data["decision"]
    return data


def test_csf_hospital_evaluate_decision_contract() -> None:
    payload = {
        "facility_name": "Test Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-123",
        "pharmacy_license_number": "LIC-123",
        "dea_number": "DEA-456",
        "pharmacist_in_charge_name": "Dr. Smith",
        "pharmacist_contact_phone": "555-1234",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [],
    }

    resp = client.post("/csf/hospital/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = _extract_decision(data)

    assert decision["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert isinstance(decision["reason"], str) and decision["reason"]

    # regulatory_references must always be present as a list (even if empty)
    assert "regulatory_references" in decision
    assert isinstance(decision["regulatory_references"], list)
    for ref in decision["regulatory_references"]:
        assert "id" in ref
        assert "label" in ref


def test_license_ohio_tddd_evaluate_decision_contract() -> None:
    payload = {
        "tddd_number": "01234567",
        "facility_name": "Example Ohio Pharmacy",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Happy path Ohio TDDD test payload.",
    }

    resp = client.post("/license/ohio-tddd/evaluate", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    decision = _extract_decision(data)

    assert decision["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert isinstance(decision["reason"], str) and decision["reason"]

    assert "regulatory_references" in decision
    assert isinstance(decision["regulatory_references"], list)
    for ref in decision["regulatory_references"]:
        assert "id" in ref
        assert "label" in ref


def test_mock_order_ohio_hospital_decision_contract() -> None:
    csf_payload = {
        "facility_name": "Ohio General Hospital",
        "facility_type": "hospital",
        "account_number": "800123456",
        "pharmacy_license_number": "LIC-12345",
        "dea_number": "AB1234567",
        "pharmacist_in_charge_name": "Dr. Jane Doe",
        "pharmacist_contact_phone": "555-123-4567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Mock order decision contract test.",
        "controlled_substances": [
            {
                "id": "cs-oxy-5mg-tab",
                "name": "Oxycodone 5 mg tablet",
                "ndc": "12345-6789-01",
                "strength": "5 mg",
                "dosage_form": "tablet",
                "dea_schedule": "II",
            }
        ],
    }

    ohio_tddd_payload = {
        "tddd_number": "01234567",
        "facility_name": "Ohio General Hospital",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Valid Ohio TDDD license for mock order contract test.",
    }

    resp = client.post(
        "/orders/mock/ohio-hospital-approval",
        json={"hospital_csf": csf_payload, "ohio_tddd": ohio_tddd_payload},
    )
    assert resp.status_code == 200

    data = resp.json()
    # For mock orders we expect `decision` wrapper
    assert "decision" in data
    decision = data["decision"]

    assert decision["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert isinstance(decision["reason"], str) and decision["reason"]

    assert "regulatory_references" in decision
    assert isinstance(decision["regulatory_references"], list)
    for ref in decision["regulatory_references"]:
        assert "id" in ref
        assert "label" in ref


def test_csf_hospital_form_copilot_contract() -> None:
    payload = {
        "facility_name": "Test Hospital",
        "facility_type": "hospital",
        "account_number": "ACC-123",
        "pharmacy_license_number": "LIC-123",
        "dea_number": "DEA-456",
        "pharmacist_in_charge_name": "Dr. Smith",
        "pharmacist_contact_phone": "555-1234",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [],
    }

    resp = client.post("/csf/hospital/form-copilot", json=payload)
    assert resp.status_code == 200

    data = resp.json()

    # Root-level contract anchored by previous tests & scenario test
    for key in [
        "status",
        "reason",
        "missing_fields",
        "regulatory_references",
        "rag_explanation",
        "artifacts_used",
        "rag_sources",
    ]:
        assert key in data

    assert data["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert isinstance(data["reason"], str) and data["reason"]
    assert isinstance(data["missing_fields"], list)
    assert isinstance(data["regulatory_references"], list)
    assert isinstance(data["artifacts_used"], list)
    assert isinstance(data["rag_sources"], list)
