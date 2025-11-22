"""
RAG-style regulatory context builder for AutoComply AI.

This module is intentionally self-contained and demo-friendly:
- No external vector store
- No network calls
- No dependency on LangChain runtime objects

Instead, it exposes a single function:

    build_regulatory_context(state: str | None,
                             purchase_intent: str | None) -> list[dict]

which returns a list of dictionaries:

    {
        "source": "<short label>",
        "snippet": "<human-readable explanation>"
    }

The structure is intentionally RAG-compatible:
later we can swap the internal implementation to use real
document chunks + embeddings without changing the API surface.
"""

from __future__ import annotations

from typing import List, Dict, Optional, TypedDict


class RegulatorySnippet(TypedDict):
    source: str
    snippet: str


# Minimal demo "knowledge base".
# In a real RAG implementation, these would be document chunks
# indexed in a vector store. For now we keep them in memory to
# keep tests stable and avoid external infra.
DEMO_RULES: List[Dict[str, str]] = [
    {
        "id": "dea_baseline_schedule_ii_v",
        "jurisdiction": "Federal / DEA",
        "topic": "Controlled substances – Schedules II–V",
        "text": (
            "Under DEA rules for controlled substances (Schedules II–V), the "
            "prescriber must hold an active DEA registration matching the "
            "state in which the patient is located and where the prescription "
            "is issued."
        ),
    },
    {
        "id": "ryan_haight_telemedicine",
        "jurisdiction": "Federal / DEA",
        "topic": "Telemedicine – Ryan Haight Act alignment",
        "text": (
            "For telemedicine prescribing of controlled substances, the "
            "Ryan Haight Act and related DEA guidance require that the "
            "prescriber comply with special conditions for remote encounters, "
            "including appropriate documentation and, where applicable, an "
            "in-person evaluation."
        ),
    },
    {
        "id": "state_baseline_license",
        "jurisdiction": "State",
        "topic": "State license alignment with ship-to",
        "text": (
            "The state professional license must remain active and in good "
            "standing in the ship-to state. If the license is expired or "
            "restricted, controlled-substance checkout must be blocked until "
            "the license is renewed or cleared."
        ),
    },
]


def _format_state_label(state: Optional[str]) -> str:
    """
    Basic helper to produce a human-readable state label.

    For now we simply echo the state code, but this helper makes
    it easy to later map 'CA' -> 'California', etc.
    """
    if not state:
        return "the relevant state"
    return state


def build_regulatory_context(
    state: Optional[str],
    purchase_intent: Optional[str] = None,
) -> List[RegulatorySnippet]:
    """
    Build a small list of RAG-style regulatory context snippets for the verdict.

    Parameters
    ----------
    state:
        Two-letter state abbreviation (e.g., 'CA') or None.
    purchase_intent:
        High-level description of the scenario (e.g., 'Telemedicine',
        'GeneralMedicalUse'). Optional.

    Returns
    -------
    List[RegulatorySnippet]
        A list of dicts with 'source' and 'snippet' keys.

    Notes
    -----
    - This is intentionally deterministic and offline-friendly.
    - It is *shaped* like a RAG layer (gathers relevant context
      snippets for the engine to attach to its verdict), so we
      can later swap the internal implementation to a true
      vector-store backed retrieval without changing callers.
    """
    state_label = _format_state_label(state)

    snippets: List[RegulatorySnippet] = []

    # 1) State-specific framing snippet
    snippets.append(
        {
            "source": f"{state_label} license & ship-to (demo)",
            "snippet": (
                f"This decision considers {state_label} state licensing and "
                "ship-to alignment for controlled substances, including the "
                "status and expiry date of the practitioner’s state permit."
            ),
            "jurisdiction": f"US-{state.upper()}" if state else None,
        }
    )

    # 2) Federal / DEA baseline rule
    dea_rule = next(
        (rule for rule in DEMO_RULES if rule["id"] == "dea_baseline_schedule_ii_v"),
        None,
    )
    if dea_rule is not None:
            snippets.append(
                {
                    "source": f"{dea_rule['jurisdiction']} – {dea_rule['topic']}",
                    "snippet": f"DEA: {dea_rule['text']}",
                    "jurisdiction": "US-DEA",
                }
            )
    else:
        # Fallback text, should not normally be hit
            snippets.append(
                {
                    "source": "Federal / DEA – Controlled substances (demo)",
                    "snippet": (
                        "DEA rules for controlled substances require an active "
                        "federal registration and appropriate state authority "
                        "for the ship-to location."
                    ),
                    "jurisdiction": "US-DEA",
                }
            )

    # 3) Scenario / purchase-intent framing (e.g., telemedicine)
    if purchase_intent:
        base_text = (
            "This scenario has been evaluated against both federal DEA "
            "requirements and state-level rules for the declared intent "
            f"'{purchase_intent}'."
        )

        if purchase_intent.lower().startswith("tele"):
            tele_rule = next(
                (rule for rule in DEMO_RULES if rule["id"] == "ryan_haight_telemedicine"),
                None,
            )
            if tele_rule is not None:
                base_text += (
                    " Ryan Haight telemedicine conditions are also taken into "
                    "account for remote prescribing contexts."
                )

        snippets.append(
            {
                "source": "Use-case context (demo)",
                "snippet": base_text,
                "jurisdiction": f"US-{state.upper()}" if state else None,
            }
        )

    return snippets
