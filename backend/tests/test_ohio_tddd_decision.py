from src.autocomply.domain.ohio_tddd import (
    DecisionStatus,
    OhioTdddCustomerResponse,
    OhioTdddForm,
    evaluate_ohio_tddd_attestation,
)


def test_exempt_with_minimum_details_ok():
    form = OhioTdddForm(
        customer_response=OhioTdddCustomerResponse.EXEMPT,
        practitioner_name="Test Practitioner",
        state_board_license_number="12345",
    )

    decision = evaluate_ohio_tddd_attestation(form)

    assert decision.status == DecisionStatus.OK_TO_SHIP
    assert decision.missing_fields == []
    assert decision.regulatory_references == ["ohio_tddd_registration"]


def test_exempt_missing_identity_goes_to_manual_review():
    form = OhioTdddForm(
        customer_response=OhioTdddCustomerResponse.EXEMPT,
        practitioner_name="",
        state_board_license_number="",
    )

    decision = evaluate_ohio_tddd_attestation(form)

    assert decision.status == DecisionStatus.MANUAL_REVIEW
    assert "practitioner_name" in decision.missing_fields
    assert "state_board_license_number" in decision.missing_fields
    assert decision.regulatory_references == ["ohio_tddd_registration"]


def test_subject_to_tddd_missing_license_blocks():
    form = OhioTdddForm(
        customer_response=OhioTdddCustomerResponse.LICENSED_OR_APPLYING,
        practitioner_name="Test Practitioner",
        state_board_license_number="12345",
        tddd_license_number="",  # missing
        tddd_license_category="",  # missing
    )

    decision = evaluate_ohio_tddd_attestation(form)

    assert decision.status == DecisionStatus.BLOCKED
    assert "tddd_license_number" in decision.missing_fields
    assert "tddd_license_category" in decision.missing_fields
    assert decision.regulatory_references == ["ohio_tddd_registration"]
