from autocomply.domain.csf_practitioner import (
    PractitionerCsfForm,
    PractitionerCsfDecision,
    PractitionerFacilityType,
    CsDecisionStatus,
    evaluate_practitioner_csf,
)


def make_base_form(**overrides) -> PractitionerCsfForm:
    base = dict(
        facility_name="Test Dental Practice",
        facility_type=PractitionerFacilityType.DENTAL_PRACTICE,
        account_number="ACC-123",
        practitioner_name="Dr. Test Practitioner",
        state_license_number="ST-12345",
        dea_number="DEA-1234567",
        ship_to_state="OH",
        attestation_accepted=True,
        internal_notes=None,
    )
    base.update(overrides)
    return PractitionerCsfForm(**base)


def test_practitioner_csf_ok_to_ship_when_all_required_fields_and_attestation():
    form = make_base_form()
    decision: PractitionerCsfDecision = evaluate_practitioner_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
    assert decision.missing_fields == []


def test_practitioner_csf_blocked_when_core_fields_missing():
    form = make_base_form(
        facility_name="",
        practitioner_name="",
        state_license_number="",
        dea_number="",
    )
    decision = evaluate_practitioner_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "facility_name" in decision.missing_fields
    assert "practitioner_name" in decision.missing_fields
    assert "state_license_number" in decision.missing_fields
    assert "dea_number" in decision.missing_fields


def test_practitioner_csf_blocked_when_attestation_not_accepted():
    form = make_base_form(attestation_accepted=False)
    decision = evaluate_practitioner_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "attestation_accepted" in decision.missing_fields
    assert "attestation" in decision.reason.lower()
