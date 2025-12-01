from typing import Any, Dict, List


def _format_controlled_substances(items: List[Any]) -> str:
    """Render controlled substances in a human-friendly list."""

    if not items:
        return "(none provided)"

    labels: List[str] = []
    for item in items:
        # Handle dict-like objects or Pydantic models with dict() method.
        if hasattr(item, "model_dump"):
            item_data = item.model_dump()
        elif hasattr(item, "dict"):
            item_data = item.dict()
        elif isinstance(item, dict):
            item_data = item
        else:
            item_data = {"name": str(item)}

        name = item_data.get("name") or item_data.get("id") or "controlled substance"
        schedule = item_data.get("dea_schedule") or item_data.get("schedule")
        labels.append(f"{name} (schedule: {schedule})" if schedule else name)

    return ", ".join(labels)


def build_csf_copilot_prompt(csf_type: str, payload: Dict[str, Any]) -> str:
    """
    Build the system/user prompt for the CSF Copilot RAG explanation.

    csf_type: "hospital" or "facility"
    payload: normalized CSF copilot request with fields like:
      - name, facility_type, account_number, ship_to_state, etc.
    """

    csf_label = "Hospital Pharmacy Controlled Substance Form (Hospital CSF)"
    if (csf_type or "").lower() == "facility":
        csf_label = "Facility Controlled Substance Form (Facility CSF)"
    elif (csf_type or "").lower() == "ems":
        csf_label = "EMS Controlled Substance Form (EMS CSF)"
    elif (csf_type or "").lower() == "researcher":
        csf_label = "Researcher Controlled Substance Form (Researcher CSF)"

    controlled_substances = _format_controlled_substances(
        payload.get("controlled_substances") or []
    )

    prompt = f"""
You are a compliance assistant helping to review a {csf_label}.

You are given:
- The completed form fields for this {csf_label}.
- Retrieved regulatory rules for controlled substances (e.g., the relevant CSF regulatory document and related policies).
- The list of controlled substances the customer wants to order.

Your job:
- Determine if the form looks compliant and whether the order should be: "ok_to_ship", "needs_review", or "blocked".
- Explain clearly WHY, in plain language, referencing specific regulatory rules where possible.
- List any obviously missing or inconsistent fields that would prevent approval.
- Do not invent regulations; only rely on the provided context and rules.

Form summary:
- Name: {payload.get("name") or ''}
- Facility type: {payload.get("facility_type") or ''}
- Account number: {payload.get("account_number") or ''}
- Pharmacy license number: {payload.get("pharmacy_license_number") or ''}
- DEA number: {payload.get("dea_number") or ''}
- Pharmacist in charge: {payload.get("pharmacist_in_charge_name") or ''}
- Pharmacist contact phone: {payload.get("pharmacist_contact_phone") or ''}
- Ship-to state: {payload.get("ship_to_state") or ''}
- Attestation accepted: {payload.get("attestation_accepted")}
- Controlled substances requested: {controlled_substances}

Now, based on the form details and retrieved regulations, answer with:
- A short status label (ok_to_ship / needs_review / blocked)
- A clear one-paragraph reason
- Any missing fields
- Any relevant regulatory references (by id or section)
""".strip()

    return prompt
