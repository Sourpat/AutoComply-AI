from autocomply.domain.csf_hospital import (
    HospitalCsfDecision,
    HospitalCsfForm,
    HospitalFacilityType,
    evaluate_hospital_csf,
)
from autocomply.domain.controlled_substances import ControlledSubstanceItem
from autocomply.domain.csf_practitioner import CsDecisionStatus


def make_base_form(**overrides) -> HospitalCsfForm:
    base = dict(
        facility_name="Test General Hospital",
        facility_type=HospitalFacilityType.HOSPITAL,
        account_number="ACC-999",
        pharmacy_license_number="PHARM-12345",
        dea_number="DEA-7654321",
        pharmacist_in_charge_name="Chief Pharmacist",
        pharmacist_contact_phone="555-123-4567",
        ship_to_state="OH",
        attestation_accepted=True,
        internal_notes=None,
    )
    base.update(overrides)
    return HospitalCsfForm(**base)


def test_hospital_csf_ok_to_ship_when_all_required_fields_and_attestation():
    form = make_base_form()
    decision: HospitalCsfDecision = evaluate_hospital_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
    assert decision.missing_fields == []


def test_hospital_csf_blocked_when_core_fields_missing():
    form = make_base_form(
        facility_name=" ",
        pharmacy_license_number=" ",
        dea_number=" ",
        pharmacist_in_charge_name=" ",
        ship_to_state="  ",
    )
    decision = evaluate_hospital_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "facility_name" in decision.missing_fields
    assert "pharmacy_license_number" in decision.missing_fields
    assert "dea_number" in decision.missing_fields
    assert "pharmacist_in_charge_name" in decision.missing_fields
    assert "ship_to_state" in decision.missing_fields


def test_hospital_csf_blocked_when_attestation_not_accepted():
    form = make_base_form(attestation_accepted=False)
    decision = evaluate_hospital_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "attestation_accepted" in decision.missing_fields
    assert "attestation" in decision.reason.lower()


def test_hospital_csf_schedule_ii_in_florida_triggers_manual_review():
    form = make_base_form(ship_to_state="FL")
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

    decision = evaluate_hospital_csf(form)

    assert decision.status == CsDecisionStatus.MANUAL_REVIEW
    assert "fl" in decision.reason.lower()
    assert "schedule" in decision.reason.lower()
    assert decision.regulatory_references == ["csf_fl_addendum"]


def test_hospital_csf_schedule_ii_non_florida_still_ok_to_ship():
    form = make_base_form(ship_to_state="OH")
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

    decision = evaluate_hospital_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
