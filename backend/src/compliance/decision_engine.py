from datetime import date
from pathlib import Path
from typing import Literal, Optional

import yaml

from pydantic import BaseModel

from src.api.models.compliance_models import (
    LicenseValidationRequest,
    ComplianceVerdict,
    AddendumRequirement,
    OCRExtractedData,
)
from src.compliance.license_validator import LicenseValidator


RULES_PATH = Path(__file__).parent / "rules" / "controlled_substance_rules.yaml"


class ComplianceEngine:

    def __init__(self):
        self.rules = self._load_rules()
        self.validator = LicenseValidator(self.rules)

    # ---------------------------------------------------------
    # Load YAML rules
    # ---------------------------------------------------------
    def _load_rules(self) -> dict:
        if not RULES_PATH.exists():
            raise FileNotFoundError(
                f"Compliance rules YAML not found: {RULES_PATH}"
            )
        with open(RULES_PATH, "r") as f:
            return yaml.safe_load(f)

    # ---------------------------------------------------------
    # OCR → Payload Converter
    # ---------------------------------------------------------
    @staticmethod
    def ocr_to_payload(ocr: OCRExtractedData) -> LicenseValidationRequest:
        """
        Normalize OCR output into the same request model used
        for manual validation.
        """
        return LicenseValidationRequest(
            practice_type=ocr.practice_type or "Standard",
            dea_number=ocr.dea_license.dea_number if ocr.dea_license else None,
            dea_expiry=ocr.dea_license.expiry_date if ocr.dea_license else None,
            state=ocr.state_license.state if ocr.state_license else None,
            state_permit=ocr.state_license.permit_number if ocr.state_license else None,
            state_expiry=ocr.state_license.expiry_date if ocr.state_license else None,
            ship_to_state=None,
            purchase_intent=None,
            quantity=None,
        )

    # ---------------------------------------------------------
    # Primary Evaluation Method
    # ---------------------------------------------------------
    def evaluate(self, payload: LicenseValidationRequest) -> ComplianceVerdict:
        """
        Central compliance logic. Delegates validation to license validator,
        then applies form/addendum state/threshold rules from YAML.
        """

        result = self.validator.validate(payload)

        form_required = result.get("form_required")
        addendum = result.get("addendum")
        allow_checkout = result.get("allow_checkout", False)
        reason = result.get("reason")
        sources = result.get("sources", [])
        metadata = result.get("metadata", {})

        addendum_obj = None
        if addendum:
            addendum_obj = AddendumRequirement(
                required=True,
                addendum_type=addendum.get("type"),
                reason=addendum.get("reason")
            )

        return ComplianceVerdict(
            is_valid=allow_checkout,
            reason=reason,
            form_required=form_required,
            addendum=addendum_obj,
            allow_checkout=allow_checkout,
            sources=sources,
            metadata=metadata
        )


class ExpiryEvaluation(BaseModel):
    """
    Simple, reusable result model for date-based license expiry logic.

    This is intentionally small and composable so it can be used both
    by the license validator and by reporting / reminders.
    """

    is_expired: bool
    days_to_expiry: Optional[int]
    bucket: Literal["expired", "near_expiry", "active"]


def evaluate_expiry(
    expiry_date: date,
    today: Optional[date] = None,
    near_expiry_window_days: int = 30,
) -> ExpiryEvaluation:
    """
    Evaluate a single expiry date into a normalized status.

    Rules:
    - If expiry_date is in the past:      bucket = "expired"
    - If expiry_date is within N days:    bucket = "near_expiry"
    - Otherwise:                          bucket = "active"

    Args:
        expiry_date: The license expiration date.
        today:       Date used as "now" (defaults to date.today()).
        near_expiry_window_days: Threshold for the "near_expiry" bucket.

    Returns:
        ExpiryEvaluation with flags and bucket.
    """
    if today is None:
        today = date.today()

    delta_days = (expiry_date - today).days
    is_expired = delta_days < 0

    if is_expired:
        bucket: Literal["expired", "near_expiry", "active"] = "expired"
        days_to_expiry: Optional[int] = None
    elif delta_days <= near_expiry_window_days:
        bucket = "near_expiry"
        days_to_expiry = delta_days
    else:
        bucket = "active"
        days_to_expiry = delta_days

    return ExpiryEvaluation(
        is_expired=is_expired,
        days_to_expiry=days_to_expiry,
        bucket=bucket,
    )
