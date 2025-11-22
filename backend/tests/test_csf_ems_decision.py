from autocomply.domain.csf_ems import (
    EmsCsfDecision,
    EmsCsfForm,
    EmsServiceType,
    evaluate_ems_csf,
)
from autocomply.domain.csf_practitioner import CsDecisionStatus


def make_base_form(**overrides) -> EmsCsfForm:
    base = dict(
        service_name="Test EMS Service",
        service_type=EmsServiceType.EMS_SERVICE,
        account_number="ACC-EMS-01",
        agency_license_number="EMS-98765",
        dea_number=None,
        medical_director_name="Dr. EMS Director",
        ship_to_state="OH",
        attestation_accepted=True,
        internal_notes=None,
    )
    base.update(overrides)
    return EmsCsfForm(**base)


def test_ems_csf_ok_to_ship_when_all_required_fields_and_attestation():
    form = make_base_form()
    decision: EmsCsfDecision = evaluate_ems_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
    assert decision.missing_fields == []


def test_ems_csf_blocked_when_core_fields_missing():
    form = make_base_form(
        service_name="",
        agency_license_number="",
        medical_director_name="",
        ship_to_state="",
    )
    decision = evaluate_ems_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "service_name" in decision.missing_fields
    assert "agency_license_number" in decision.missing_fields
    assert "medical_director_name" in decision.missing_fields
    assert "ship_to_state" in decision.missing_fields


def test_ems_csf_blocked_when_attestation_not_accepted():
    form = make_base_form(attestation_accepted=False)
    decision = evaluate_ems_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "attestation_accepted" in decision.missing_fields
    assert "attestation" in decision.reason.lower()
