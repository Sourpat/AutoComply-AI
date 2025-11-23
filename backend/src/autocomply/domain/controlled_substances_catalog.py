from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import List, Optional


@dataclass(frozen=True)
class ControlledSubstance:
    id: str
    name: str
    strength: Optional[str] = None
    unit: Optional[str] = None
    schedule: Optional[str] = None
    dea_code: Optional[str] = None


@dataclass(frozen=True)
class ControlledSubstanceHistoryItem(ControlledSubstance):
    account_number: Optional[str] = None
    last_ordered_at: Optional[date] = None


# ---------------------------------------------------------------------------
# Stub catalog
# ---------------------------------------------------------------------------

CATALOG: List[ControlledSubstance] = [
    ControlledSubstance(
        id="cs_oxycodone_5mg_tab",
        name="Oxycodone 5 mg tablet",
        strength="5",
        unit="mg",
        schedule="II",
        dea_code="9143",
    ),
    ControlledSubstance(
        id="cs_hydrocodone_10_325_tab",
        name="Hydrocodone/Acetaminophen 10mg/325mg tablet",
        strength="10/325",
        unit="mg",
        schedule="II",
        dea_code="9193",
    ),
    ControlledSubstance(
        id="cs_diazepam_5mg_tab",
        name="Diazepam 5 mg tablet",
        strength="5",
        unit="mg",
        schedule="IV",
        dea_code="9128",
    ),
    ControlledSubstance(
        id="cs_morphine_15mg_tab",
        name="Morphine sulfate 15 mg tablet",
        strength="15",
        unit="mg",
        schedule="II",
        dea_code="9300",
    ),
    ControlledSubstance(
        id="cs_fentanyl_100mcg_patch",
        name="Fentanyl 100 mcg/hr transdermal patch",
        strength="100",
        unit="mcg/hr",
        schedule="II",
        dea_code="9801",
    ),
]


# ---------------------------------------------------------------------------
# Stub account history
# ---------------------------------------------------------------------------

# Map account_number -> list of history items
_ACCOUNT_HISTORY: dict[str, List[ControlledSubstanceHistoryItem]] = {
    "ACC-123": [
        ControlledSubstanceHistoryItem(
            **CATALOG[0].__dict__,
            account_number="ACC-123",
            last_ordered_at=date(2024, 10, 1),
        ),
        ControlledSubstanceHistoryItem(
            **CATALOG[1].__dict__,
            account_number="ACC-123",
            last_ordered_at=date(2024, 9, 20),
        ),
    ],
    "ACC-FL-001": [
        ControlledSubstanceHistoryItem(
            **CATALOG[0].__dict__,
            account_number="ACC-FL-001",
            last_ordered_at=date(2024, 8, 15),
        ),
        ControlledSubstanceHistoryItem(
            **CATALOG[3].__dict__,
            account_number="ACC-FL-001",
            last_ordered_at=date(2024, 8, 10),
        ),
    ],
}


def search_controlled_substances(query: str) -> List[ControlledSubstance]:
    """
    Very simple in-memory search:
    - case-insensitive substring match on name
    - OR exact match on dea_code
    """
    q = query.strip().lower()
    if not q:
        return []

    results: List[ControlledSubstance] = []
    for item in CATALOG:
        if q in item.name.lower():
            results.append(item)
            continue
        if item.dea_code and item.dea_code.lower() == q:
            results.append(item)
            continue

    return results


def get_history_for_account(
    account_number: str,
) -> List[ControlledSubstanceHistoryItem]:
    """
    Returns a list of recent controlled substances ordered by this account.
    Stubbed from the _ACCOUNT_HISTORY mapping above.
    """
    return _ACCOUNT_HISTORY.get(account_number.strip(), [])
