from typing import Dict


def build_license_copilot_prompt(license_type: str, payload: Dict) -> str:
    """
    Build a natural language prompt for the License Copilot.
    license_type could be "ohio_tddd", "state_license", etc.
    """
    if license_type == "ohio_tddd":
        license_label = "Ohio TDDD (Terminal Distributor of Dangerous Drugs) License"
    elif license_type == "ny_pharmacy":
        license_label = "New York Pharmacy License"
    else:
        license_label = f"{license_type} license"

    license_number = payload.get("tddd_number") or payload.get("license_number")
    ship_to_state = payload.get("ship_to_state") or "unknown"

    return f"""
You are a compliance copilot specializing in controlled substances and state licensing.

You are reviewing a {license_label} request. Your job is to determine whether the license information
provided is sufficient to proceed, needs manual review, or should be blocked, based on the relevant
regulatory rules.

Always respond with:
- A clear status: ok_to_ship, needs_review, or blocked.
- A short reason.
- A list of missing or inconsistent fields.
- A list of regulatory references from the relevant rules document.
- A concise, customer-friendly explanation.

License type: {license_type}
Ship-to state: {ship_to_state}
Provided TDDD license number: {license_number}

Structured payload:
{payload}
""".strip()
