from typing import Any, Dict, List, Optional


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
    lines: List[str] = []

    allow_checkout = verdict.get("allow_checkout")
    status = verdict.get("status") or "Unknown"
    state = verdict.get("state") or "Unknown state"
    days_to_expiry = verdict.get("days_to_expiry")
    is_expired = verdict.get("is_expired")

    # 1) High-level decision
    if allow_checkout:
        lines.append(f"Decision: Checkout allowed ({status}).")
    else:
        lines.append(f"Decision: Checkout blocked ({status}).")

    # 2) Expiry context
    if is_expired:
        lines.append("Reason: The license appears expired based on state expiry rules.")
    elif isinstance(days_to_expiry, int):
        if days_to_expiry < 0:
            lines.append("Reason: The license expiry date is in the past.")
        elif days_to_expiry <= 30:
            lines.append(
                f"Reason: The license is near expiry (approximately {days_to_expiry} days remaining)."
            )
        else:
            lines.append(
                f"Reason: The license is active with approximately {days_to_expiry} days remaining."
            )

    # 3) RAG context summarisation
    jurisdictions: List[str] = []
    sample_snippet: Optional[str] = None

    if regulatory_context:
        for item in regulatory_context:
            if not isinstance(item, dict):
                continue
            j = item.get("jurisdiction")
            if j and j not in jurisdictions:
                jurisdictions.append(j)
            if sample_snippet is None:
                snippet = (item.get("snippet") or "").strip()
                if snippet:
                    sample_snippet = snippet

    if jurisdictions:
        lines.append(
            f"Regulatory alignment: Decision references rules for {', '.join(jurisdictions)}."
        )

    if sample_snippet:
        preview = sample_snippet
        if len(preview) > 180:
            preview = preview[:180] + "…"
        lines.append(f"Example source snippet: {preview}")

    # 4) Fallback if we somehow produced nothing useful
    if not lines:
        return f"Decision summary for {state}: {status}."

    return " ".join(lines)
