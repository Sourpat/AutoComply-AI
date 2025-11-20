from typing import Optional
from datetime import datetime, date

from src.api.models.compliance_models import LicenseValidationRequest
from src.compliance.decision_engine import evaluate_expiry


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
            "allow_checkout": None,
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

        # --- Expiry evaluation using shared helper ---
        # Assumes the incoming model has a date-like field for expiry
        # such as `state_expiry`. If the field name differs, use the
        # appropriate attribute from the request model.

        expiry_date = getattr(payload, "state_expiry", None)
        parsed_expiry_date = None

        if expiry_date:
            if isinstance(expiry_date, str):
                try:
                    parsed_expiry_date = date.fromisoformat(expiry_date)
                except ValueError:
                    parsed_expiry_date = None
            elif isinstance(expiry_date, datetime):
                parsed_expiry_date = expiry_date.date()
            elif isinstance(expiry_date, date):
                parsed_expiry_date = expiry_date

        if parsed_expiry_date:
            expiry_eval = evaluate_expiry(
                expiry_date=parsed_expiry_date,
                today=date.today(),
                near_expiry_window_days=30,
            )

            if isinstance(result, dict):
                result["is_expired"] = expiry_eval.is_expired
                result["days_to_expiry"] = expiry_eval.days_to_expiry
                result["expiry_bucket"] = expiry_eval.bucket
            else:
                if hasattr(result, "is_expired"):
                    result.is_expired = expiry_eval.is_expired
                if hasattr(result, "days_to_expiry"):
                    result.days_to_expiry = expiry_eval.days_to_expiry
                if hasattr(result, "expiry_bucket"):
                    result.expiry_bucket = expiry_eval.bucket

            # Apply simple business rule: expired → block checkout
            if expiry_eval.is_expired:
                if isinstance(result, dict):
                    result["allow_checkout"] = False
                    base_reason = result.get("reason") or ""
                    result["reason"] = (
                        base_reason + " License is expired."
                    ).strip()
                else:
                    if hasattr(result, "allow_checkout"):
                        result.allow_checkout = False
                    if hasattr(result, "reason"):
                        base_reason = getattr(result, "reason") or ""
                        setattr(
                            result,
                            "reason",
                            (base_reason + " License is expired.").strip(),
                        )

        # ----------------------------------------
        # 4. Checkout gating
        # ----------------------------------------
        # If we reached here with no fatal errors → allow checkout
        if result.get("allow_checkout") is not False:
            result["allow_checkout"] = True
        if not result.get("reason"):
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
