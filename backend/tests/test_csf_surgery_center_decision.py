from autocomply.domain.csf_surgery_center import (
    SurgeryCenterCsfDecision,
    SurgeryCenterCsfForm,
    SurgeryFacilityType,
    evaluate_surgery_center_csf,
)
from autocomply.domain.csf_practitioner import CsDecisionStatus


def make_base_form(**overrides) -> SurgeryCenterCsfForm:
    base = dict(
        facility_name="Test Ambulatory Surgery Center",
        facility_type=SurgeryFacilityType.AMBULATORY_SURGERY_CENTER,
        account_number="ACC-456",
        facility_license_number="SURG-12345",
        dea_number="DEA-1112223",
        medical_director_name="Dr. Surgery Director",
        ship_to_state="OH",
        attestation_accepted=True,
        internal_notes=None,
    )
    base.update(overrides)
    return SurgeryCenterCsfForm(**base)


def test_surgery_center_csf_ok_to_ship_when_all_required_fields_and_attestation():
    form = make_base_form()
    decision: SurgeryCenterCsfDecision = evaluate_surgery_center_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
    assert decision.missing_fields == []


def test_surgery_center_csf_blocked_when_core_fields_missing():
    form = make_base_form(
        facility_name="",
        facility_license_number="",
        dea_number="",
        medical_director_name="",
        ship_to_state="",
    )
    decision = evaluate_surgery_center_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "facility_name" in decision.missing_fields
    assert "facility_license_number" in decision.missing_fields
    assert "dea_number" in decision.missing_fields
    assert "medical_director_name" in decision.missing_fields
    assert "ship_to_state" in decision.missing_fields


def test_surgery_center_csf_blocked_when_attestation_not_accepted():
    form = make_base_form(attestation_accepted=False)
    decision = evaluate_surgery_center_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "attestation_accepted" in decision.missing_fields
    assert "attestation" in decision.reason.lower()
