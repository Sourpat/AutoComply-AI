from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class RegulationSnippet:
    """
    Minimal representation of a regulatory rule / snippet.

    This is intentionally simple and in-memory only. The goal is to show
    how AutoComply AI can attach regulatory context (DEA / state rules)
    to a license decision, even before we plug in a full vector DB.
    """

    id: str
    jurisdiction: str  # e.g. "US-DEA", "US-CA", "US-NY"
    topic: str         # e.g. "Schedule II", "Telemedicine", "CSR"
    text: str          # human-readable summary
    source: str        # citation or human-readable source label


# ---------------------------------------------------------------------------
# In-memory sample snippets (placeholder for future RAG-backed KB)
# ---------------------------------------------------------------------------

_SAMPLE_SNIPPETS: List[RegulationSnippet] = [
    RegulationSnippet(
        id="dea-sched-ii-us",
        jurisdiction="US-DEA",
        topic="Schedule II",
        text=(
            "Practitioner must hold a valid DEA registration with authority "
            "for Schedule II substances to prescribe or order Schedule II drugs."
        ),
        source="DEA – Controlled Substances Act (summary)",
    ),
    RegulationSnippet(
        id="ca-csr-required",
        jurisdiction="US-CA",
        topic="CSR",
        text=(
            "In California, a separate state-controlled substance registration "
            "may be required in addition to a DEA number for certain activities."
        ),
        source="CA Board of Pharmacy (summary)",
    ),
    RegulationSnippet(
        id="telemed-ryan-haight",
        jurisdiction="US-FED",
        topic="Telemedicine",
        text=(
            "For telemedicine prescribing of controlled substances, additional "
            "requirements under the Ryan Haight Act and related rules apply."
        ),
        source="Ryan Haight Act (summary)",
    ),
]


def list_all_snippets() -> List[RegulationSnippet]:
    """
    Return all in-memory snippets.

    This is primarily for debugging and future tests; in a real RAG
    implementation this would be replaced by a query into a vector store.
    """
    return list(_SAMPLE_SNIPPETS)


def get_snippets_for_jurisdiction(
    jurisdiction: str,
    topic: Optional[str] = None,
) -> List[RegulationSnippet]:
    """
    Filter snippets by jurisdiction and optional topic.

    Args:
        jurisdiction: e.g. 'US-CA', 'US-DEA'
        topic:        optional topic filter (e.g. 'Schedule II').

    Returns:
        List of RegulationSnippet objects.
    """
    results = [
        s for s in _SAMPLE_SNIPPETS
        if s.jurisdiction.lower() == jurisdiction.lower()
    ]

    if topic:
        results = [s for s in results if s.topic.lower() == topic.lower()]

    return results
