from autocomply.domain.controlled_substances import ControlledSubstanceItem
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
    assert decision.regulatory_references == ["csf_researcher_form"]


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
    assert decision.regulatory_references == ["csf_researcher_form"]


def test_researcher_csf_blocked_when_attestation_not_accepted():
    form = make_base_form(attestation_accepted=False)
    decision = evaluate_researcher_csf(form)

    assert decision.status == CsDecisionStatus.BLOCKED
    assert "attestation_accepted" in decision.missing_fields
    assert "attestation" in decision.reason.lower()
    assert decision.regulatory_references == ["csf_researcher_form"]


def test_researcher_csf_schedule_ii_in_florida_triggers_manual_review():
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

    decision = evaluate_researcher_csf(form)

    assert decision.status == CsDecisionStatus.MANUAL_REVIEW
    assert "fl" in decision.reason.lower()
    assert "schedule" in decision.reason.lower()
    assert decision.regulatory_references == [
        "csf_researcher_form",
        "csf_fl_addendum",
    ]


def test_researcher_csf_schedule_ii_non_florida_still_ok_to_ship():
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

    decision = evaluate_researcher_csf(form)

    assert decision.status == CsDecisionStatus.OK_TO_SHIP
    assert decision.regulatory_references == ["csf_researcher_form"]
