import re
from typing import Optional

from fastapi import HTTPException

from src.api.models.compliance_models import PracticeType


# ----------------------------
# DEA Number Validation
# ----------------------------

DEA_REGEX = r"^[A-Z]{2}[0-9]{7}$"  # Simple standard DEA format (AA1234567)


def validate_dea_number(dea_number: Optional[str]):
    """
    Basic DEA number pattern validation.
    DEA numbers vary but the AA####### format is the standard base.
    """
    if not dea_number:
        return

    if not re.match(DEA_REGEX, dea_number):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid DEA number format: {dea_number}. Expected AA1234567."
        )


# ----------------------------
# State Code Validation
# ----------------------------

VALID_STATE_CODES = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
    "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
}


def validate_state_code(state: Optional[str]):
    if not state:
        return

    upper = state.upper()
    if upper not in VALID_STATE_CODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid US state code: '{state}'."
        )


# ----------------------------
# Practice Type Validation
# ----------------------------

VALID_PRACTICE_TYPES = {
    "Standard",
    "HospitalPharmacy",
    "EMS",
    "Researcher",
    "SurgeryCentre",
    "FloridaPractitioner"
}


def validate_practice_type(practice_type: PracticeType):
    if practice_type not in VALID_PRACTICE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid practice type: {practice_type}"
        )


# ----------------------------
# Quantity Validation
# ----------------------------

def validate_quantity(quantity: Optional[int]):
    if quantity is None:
        return

    if quantity < 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity cannot be negative."
        )


# ----------------------------
# Ship-To Validation
# ----------------------------

def validate_ship_to_state(ship_to: Optional[str]):
    validate_state_code(ship_to)  # same logic as state license validation


# ----------------------------
# Purchase Intent Validation
# ----------------------------

VALID_PURCHASE_INTENT = {
    "GeneralMedicalUse",
    "Testosterone",
    "WeightLoss",
    "Research",
}


def validate_purchase_intent(intent: Optional[str]):
    if not intent:
        return

    if intent not in VALID_PURCHASE_INTENT:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid purchase intent: {intent}"
        )


# ----------------------------
# Master Validator (Used by Route)
# ----------------------------

def validate_license_payload(payload):
    """
    Validates all fields of LicenseValidationRequest before the
    compliance engine processes them.
    """

    validate_practice_type(payload.practice_type)
    validate_dea_number(payload.dea_number)
    validate_state_code(payload.state)
    validate_ship_to_state(payload.ship_to_state)
    validate_quantity(payload.quantity)
    validate_purchase_intent(payload.purchase_intent)

    return True
