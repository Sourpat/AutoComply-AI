# backend/tests/test_attestations_engine.py

from datetime import date, timedelta

from src.api.models.compliance_models import LicenseValidationRequest
from src.compliance.decision_engine import ComplianceEngine


def _base_payload() -> LicenseValidationRequest:
    today = date.today()
    future_date = today + timedelta(days=365)

    return LicenseValidationRequest(
        practice_type="Standard",
        state="CA",
        state_permit="C987654",
        state_expiry=future_date.isoformat(),
        purchase_intent="GeneralMedicalUse",
        quantity=10,
    )


def test_telemedicine_ca_requires_ryan_haight_attestation():
    """
    Telemedicine into CA should require a Ryan Haight-style attestation.

    This does NOT block checkout by itself; instead, it populates the
    `attestations_required` list on the verdict so that the frontend
    and workflow layer can enforce acknowledgement.
    """
    base = _base_payload()
    base.practice_type = "Telemedicine"
    base.purchase_intent = "TelemedicineRemoteConsult"

    engine = ComplianceEngine()
    verdict = engine.evaluate(base)

    assert verdict.attestations_required, "Expected at least one attestation for telemedicine CA"

    attestation_ids = {a.id for a in verdict.attestations_required}
    assert "ryan_haight_telemedicine" in attestation_ids


def test_standard_ca_does_not_require_attestation():
    """
    A standard, non-telemedicine CA license should not require
    any additional attestations by default.
    """
    base = _base_payload()

    engine = ComplianceEngine()
    verdict = engine.evaluate(base)

    assert isinstance(verdict.attestations_required, list)
    assert len(verdict.attestations_required) == 0
