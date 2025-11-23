from fastapi.testclient import TestClient

from src.api.main import app
from autocomply.domain.ohio_tddd import OhioTdddDecisionStatus

client = TestClient(app)


def test_ohio_tddd_explain_approved_application():
    payload = {
        "decision": {
            "status": OhioTdddDecisionStatus.APPROVED.value,
            "reason": "Ohio TDDD application meets current registration rules.",
            "missing_fields": [],
            "regulatory_references": ["ohio_tddd_registration"],
        }
    }

    resp = client.post("/ohio-tddd/explain", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    explanation = data["explanation"].lower()

    assert "application is approved" in explanation
    assert "ohio tddd" in explanation
    assert "regulatory basis" in explanation
    assert "ohio_tddd_registration" in explanation
    assert data["regulatory_references"] == ["ohio_tddd_registration"]


def test_ohio_tddd_explain_blocked_missing_fields():
    payload = {
        "decision": {
            "status": OhioTdddDecisionStatus.BLOCKED.value,
            "reason": "Ohio TDDD application is missing required fields: business_name.",
            "missing_fields": ["business_name"],
            "regulatory_references": ["ohio_tddd_registration"],
        }
    }

    resp = client.post("/ohio-tddd/explain", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    explanation = data["explanation"].lower()

    assert "application is blocked" in explanation
    assert "missing or incomplete fields" in explanation
    assert "business_name" in explanation
    assert "ohio tddd" in explanation
    assert data["regulatory_references"] == ["ohio_tddd_registration"]
