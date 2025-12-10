from typing import Any, Dict, List, Optional


def _status_phrase(status: Optional[str], allow_checkout: Optional[bool]) -> str:
    """Convert internal status flags into a human-readable assessment."""

    normalized = (status or "").lower()

    if allow_checkout or "ok_to_ship" in normalized or "approved" in normalized:
        return "appropriate to proceed with shipment"
    if "review" in normalized:
        return "not fully clear and should be reviewed"
    if allow_checkout is False or "block" in normalized or "deny" in normalized:
        return "not permitted to proceed as-is"

    return "under evaluation"


def explain_verdict_with_context(
    verdict: Dict[str, Any],
    regulatory_context: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Build a human-readable explanation for a license decision using:
    - the final verdict (allow/deny, expiry, etc.)
    - the attached regulatory_context RAG snippets (if any)

    This implementation is intentionally deterministic and offline-safe so that
    CI tests do not depend on an LLM. Later, this can be upgraded to call
    a hosted model while keeping the same function signature.
    """
    allow_checkout = verdict.get("allow_checkout")
    status = verdict.get("status") or "Unknown"
    state = verdict.get("state") or "Unknown state"
    days_to_expiry = verdict.get("days_to_expiry")
    is_expired = verdict.get("is_expired")

    jurisdictions: List[str] = []
    sample_snippet: Optional[str] = None
    primary_source_label: Optional[str] = None

    if regulatory_context:
        for item in regulatory_context:
            if not isinstance(item, dict):
                continue
            if not primary_source_label:
                source_label = (item.get("source") or "").strip()
                if source_label:
                    primary_source_label = source_label
            j = item.get("jurisdiction")
            if j and j not in jurisdictions:
                jurisdictions.append(j)
            if sample_snippet is None:
                snippet = (item.get("snippet") or "").strip()
                if snippet:
                    sample_snippet = snippet

    status_phrase = _status_phrase(status, allow_checkout)

    parts: List[str] = []

    if jurisdictions:
        parts.append(
            f"AutoComply AI assessment: Based on current rules for {', '.join(jurisdictions)}, "
            f"this request appears {status_phrase}."
        )
    else:
        parts.append(
            f"AutoComply AI assessment: Based on the provided details, this request appears {status_phrase}."
        )

    if is_expired:
        parts.append("License timing: The license appears expired based on state expiry rules.")
    elif isinstance(days_to_expiry, int):
        if days_to_expiry < 0:
            parts.append("License timing: The license expiry date is in the past.")
        elif days_to_expiry <= 30:
            parts.append(
                f"License timing: The license is near expiry (about {days_to_expiry} days remaining)."
            )
        else:
            parts.append(
                f"License timing: The license is active with approximately {days_to_expiry} days remaining."
            )

    if primary_source_label:
        parts.append(
            f"Regulatory reference: This assessment is informed by {primary_source_label} and related guidance."
        )

    if sample_snippet:
        preview = sample_snippet
        if len(preview) > 180:
            preview = preview[:180] + "…"
        parts.append(f"Supporting context: {preview}")

    if not parts:
        return f"Decision summary for {state}: {status}."

    return " ".join(parts)
