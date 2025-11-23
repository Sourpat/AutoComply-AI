from autocomply.domain.csf_practitioner import (
    PractitionerCsfForm,
    PractitionerCsfDecision,
    PractitionerFacilityType,
    CsDecisionStatus,
    evaluate_practitioner_csf,
)
from autocomply.domain.controlled_substances import ControlledSubstanceItem


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


def test_practitioner_csf_schedule_ii_in_florida_triggers_manual_review():
    form = make_base_form(
        ship_to_state="FL",
    )
    form.controlled_substances = [
        ControlledSubstanceItem(
            id="cs-oxy-5mg-tab",
            name="Oxycodone 5 mg tablet",
            ndc="12345-6789-01",
            strength="5 mg",
            dosage_form="tablet",
            dea_schedule="II",
        )
    ]

    decision: PractitionerCsfDecision = evaluate_practitioner_csf(form)

    assert decision.status == CsDecisionStatus.MANUAL_REVIEW
    assert "schedule" in decision.reason.lower()
    assert "fl" in decision.reason.lower()
    assert decision.regulatory_references == ["csf_fl_addendum"]


def test_practitioner_csf_schedule_ii_non_florida_still_ok_to_ship():
    form = make_base_form(
        ship_to_state="OH",
    )
    form.controlled_substances = [
        ControlledSubstanceItem(
            id="cs-oxy-5mg-tab",
            name="Oxycodone 5 mg tablet",
            ndc="12345-6789-01",
            strength="5 mg",
            dosage_form="tablet",
            dea_schedule="II",
        )
    ]

    decision: PractitionerCsfDecision = evaluate_practitioner_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
