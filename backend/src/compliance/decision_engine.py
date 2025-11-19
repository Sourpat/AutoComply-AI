import yaml
from pathlib import Path

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
