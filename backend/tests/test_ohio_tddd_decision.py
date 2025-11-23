from autocomply.domain.ohio_tddd import (
    OhioTdddDecisionStatus,
    OhioTdddForm,
    evaluate_ohio_tddd,
)


def make_base_form(**overrides) -> OhioTdddForm:
    data = {
        "business_name": "Example Dental Clinic",
        "license_type": "clinic",
        "license_number": "TDDD-123456",
        "ship_to_state": "OH",
    }
    data.update(overrides)
    return OhioTdddForm(**data)


def test_ohio_tddd_out_of_state_requires_manual_review():
    form = make_base_form(
        ship_to_state="PA",  # non-OH
    )

    decision = evaluate_ohio_tddd(form)

    assert decision.status == OhioTdddDecisionStatus.MANUAL_REVIEW
    assert "ship-to state" in decision.reason.lower()
    assert "manual review" in decision.reason.lower()
    assert "pa" in decision.reason.lower()
    assert decision.regulatory_references == ["ohio_tddd_registration"]


def test_ohio_tddd_valid_in_state_application_approved():
    form = make_base_form(ship_to_state="OH")

    decision = evaluate_ohio_tddd(form)

    assert decision.status == OhioTdddDecisionStatus.APPROVED
    assert "application meets current in-state registration rules" in decision.reason.lower()
    assert decision.regulatory_references == ["ohio_tddd_registration"]


def test_ohio_tddd_missing_fields_blocked():
    form = make_base_form(business_name="", license_number="")

    decision = evaluate_ohio_tddd(form)

    assert decision.status == OhioTdddDecisionStatus.BLOCKED
    assert "business_name" in decision.missing_fields
    assert "license_number" in decision.missing_fields
    assert decision.regulatory_references == ["ohio_tddd_registration"]
