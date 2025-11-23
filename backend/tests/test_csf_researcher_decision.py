from autocomply.domain.csf_practitioner import CsDecisionStatus
from autocomply.domain.csf_researcher import (
    ResearchFacilityType,
    ResearcherCsfDecision,
    ResearcherCsfForm,
    evaluate_researcher_csf,
)


def make_base_form(**overrides) -> ResearcherCsfForm:
    base = dict(
        institution_name="Test University",
        facility_type=ResearchFacilityType.UNIVERSITY,
        account_number="ACC-R-001",
        principal_investigator_name="Dr. Test PI",
        researcher_title="Principal Investigator",
        state_license_number=None,
        dea_number=None,
        protocol_or_study_id="PROT-12345",
        ship_to_state="OH",
        attestation_accepted=True,
        internal_notes=None,
    )
    base.update(overrides)
    return ResearcherCsfForm(**base)


def test_researcher_csf_ok_to_ship_when_required_fields_and_attestation():
    form = make_base_form()
    decision: ResearcherCsfDecision = evaluate_researcher_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
    assert decision.missing_fields == []


def test_researcher_csf_blocked_when_core_fields_missing():
    form = make_base_form(
        institution_name="",
        principal_investigator_name="",
        protocol_or_study_id="",
        ship_to_state="",
    )
    decision = evaluate_researcher_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "institution_name" in decision.missing_fields
    assert "principal_investigator_name" in decision.missing_fields
    assert "protocol_or_study_id" in decision.missing_fields
    assert "ship_to_state" in decision.missing_fields


def test_researcher_csf_blocked_when_attestation_not_accepted():
    form = make_base_form(attestation_accepted=False)
    decision = evaluate_researcher_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "attestation_accepted" in decision.missing_fields
    assert "attestation" in decision.reason.lower()
