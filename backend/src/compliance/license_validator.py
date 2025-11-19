from typing import Optional
from datetime import datetime

from src.api.models.compliance_models import LicenseValidationRequest


class LicenseValidator:
    """
    Core rule interpreter. Applies YAML-driven rules to determine:
    - Required practice-type form
    - Addendum requirements (testosterone, weight-loss threshold)
    - DEA/state validity logic
    - Checkout blocking logic
    """

    def __init__(self, rules: dict):
        self.rules = rules

    # ---------------------------------------------------------
    # Public entry point
    # ---------------------------------------------------------
    def validate(self, payload: LicenseValidationRequest) -> dict:
        practice_rules = self.rules.get("practice_types", {})
        dea_rules = self.rules.get("dea_license_rules", [])
        intent_rules = self.rules.get("purchase_intent_rules", {})
        state_specific_rules = self.rules.get("state_specific", {})

        result = {
            "form_required": None,
            "addendum": None,
            "allow_checkout": False,
            "reason": None,
            "sources": [],
            "metadata": {},
        }

        # ----------------------------------------
        # 1. Practice-type → Form mapping
        # ----------------------------------------
        form_info = practice_rules.get(payload.practice_type)
        if form_info:
            result["form_required"] = form_info.get("form")

        # Florida additional logic
        if payload.practice_type == "Standard":
            if payload.ship_to_state == "FL":
                fl_rule = state_specific_rules.get("Florida", {})
                if fl_rule.get("requires_state_addendum", False):
                    result["form_required"] = fl_rule["required_forms"][0]

        # ----------------------------------------
        # 2. DEA Rules (expiry logic, TCX logic)
        # ----------------------------------------
        for rule in dea_rules:
            scenario = rule.get("scenario")
            expired = rule.get("expired")
            near_expiry = rule.get("near_expiry")
            checkout_prompt = rule.get("checkout_prompt")

            # Apply expiry logic if needed
            if expired and payload.dea_expiry:
                if self._is_expired(payload.dea_expiry):
                    result["allow_checkout"] = False
                    result["reason"] = f"DEA license expired."
                    return result

            if near_expiry and payload.dea_expiry:
                if self._is_near_expiry(payload.dea_expiry):
                    # Still allow checkout, but flagged
                    result["metadata"]["dea_near_expiry"] = True

            # If checkout prompt required
            if checkout_prompt:
                result["metadata"]["checkout_prompt"] = True

        # ----------------------------------------
        # 3. Purchase intent → Addendum logic
        # ----------------------------------------
        if payload.purchase_intent in intent_rules:
            intent_spec = intent_rules[payload.purchase_intent]

            # Testosterone — vial qty threshold
            if "thresholds" in intent_spec:
                for key, rule in intent_spec["thresholds"].items():
                    limit = rule["limit"]
                    needs_addendum = rule["addendum_required"]

                    if payload.quantity and payload.quantity >= limit:
                        if needs_addendum:
                            result["addendum"] = {
                                "type": rule["addendum"],
                                "reason": f"Quantity ≥ {limit}",
                            }

        # ----------------------------------------
        # 4. Checkout gating
        # ----------------------------------------
        # If we reached here with no fatal errors → allow checkout
        result["allow_checkout"] = True
        if not result["reason"]:
            result["reason"] = "License validated successfully."

        return result

    # ---------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------

    def _is_expired(self, expiry: str) -> bool:
        """Return True if today > expiry date."""
        try:
            exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
            return datetime.today().date() > exp_date
        except:
            return False

    def _is_near_expiry(self, expiry: str) -> bool:
        """Return True if within 90 days of expiry."""
        try:
            exp_date = datetime.strptime(expiry, "%Y-%m-%d").date()
            delta = (exp_date - datetime.today().date()).days
            return 0 <= delta <= 90
        except:
            return False
