from fastapi.testclient import TestClient

from autocomply.domain.csf_practitioner import CsDecisionStatus
from src.api.main import app

client = TestClient(app)


def test_csf_explain_ok_to_ship_without_references():
    payload = {
        "csf_type": "practitioner",
        "decision": {
            "status": CsDecisionStatus.OK_TO_SHIP.value,
            "reason": "All required fields and attestation are present.",
            "missing_fields": [],
            "regulatory_references": [],
        },
    }

    resp = client.post("/csf/explain", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    explanation = data["explanation"].lower()

    assert "practitioner csf decision" in explanation
    assert "allowed to proceed" in explanation
    assert data["regulatory_references"] == []


def test_csf_explain_manual_review_with_florida_addendum_reference():
    payload = {
        "csf_type": "practitioner",
        "decision": {
            "status": CsDecisionStatus.MANUAL_REVIEW.value,
            "reason": (
                "CSF includes high-risk Schedule II controlled substances for "
                "ship-to state FL. Example item(s): Oxycodone 5 mg tablet. "
                "Requires manual compliance review per Florida Controlled "
                "Substances Addendum (csf_fl_addendum)."
            ),
            "missing_fields": [],
            "regulatory_references": ["csf_fl_addendum"],
        },
    }

    resp = client.post("/csf/explain", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    explanation = data["explanation"].lower()

    # High-level decision summary
    assert "manual compliance review" in explanation

    # Should mention the addendum by name/id via coverage
    assert "florida controlled substances addendum" in explanation
    assert "csf_fl_addendum" in explanation

    # Structured echo
    assert data["regulatory_references"] == ["csf_fl_addendum"]
