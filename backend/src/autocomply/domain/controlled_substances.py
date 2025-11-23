from typing import List, Optional

from pydantic import BaseModel, Field


class ControlledSubstanceItem(BaseModel):
    """
    Minimal normalized view of a controlled substance item.

    In a real integration this would be hydrated from the e-commerce catalog
    or a drug reference system. Here we keep a small mock set for sandboxing.
    """

    id: str
    name: str = Field(..., description="Display name, e.g. 'Oxycodone 5 mg tablet'")
    ndc: Optional[str] = Field(
        default=None,
        description="National Drug Code or internal SKU, if available.",
    )
    strength: Optional[str] = None  # e.g. "5 mg", "10 mg/mL"
    dosage_form: Optional[str] = None  # e.g. "tablet", "capsule", "injection"
    dea_schedule: Optional[str] = None  # e.g. "II", "III", etc.


# Simple mock catalog for now – can be replaced by a real search adapter later.
MOCK_CONTROLLED_SUBSTANCES: List[ControlledSubstanceItem] = [
    ControlledSubstanceItem(
        id="cs-oxy-5mg-tab",
        name="Oxycodone 5 mg tablet",
        ndc="12345-6789-01",
        strength="5 mg",
        dosage_form="tablet",
        dea_schedule="II",
    ),
    ControlledSubstanceItem(
        id="cs-hydro-5-325-tab",
        name="Hydrocodone 5 mg / Acetaminophen 325 mg tablet",
        ndc="22222-3333-44",
        strength="5 mg / 325 mg",
        dosage_form="tablet",
        dea_schedule="II",
    ),
    ControlledSubstanceItem(
        id="cs-fent-100mcg-patch",
        name="Fentanyl 100 mcg/hr transdermal patch",
        ndc="99999-1111-22",
        strength="100 mcg/hr",
        dosage_form="transdermal patch",
        dea_schedule="II",
    ),
    ControlledSubstanceItem(
        id="cs-morph-10mg-ml-inj",
        name="Morphine sulfate 10 mg/mL injection",
        ndc="55555-6666-77",
        strength="10 mg/mL",
        dosage_form="injection",
        dea_schedule="II",
    ),
]


def search_controlled_substances(query: str, limit: int = 10) -> List[ControlledSubstanceItem]:
    """
    Very simple case-insensitive substring search across name + NDC.

    - If query is blank, return top N items.
    - In real life, this function would be an adapter to a product search API.
    """

    q = (query or "").strip().lower()
    items = MOCK_CONTROLLED_SUBSTANCES

    if not q:
        return items[:limit]

    filtered = [
        item
        for item in items
        if q in item.name.lower() or (item.ndc and q in item.ndc.lower())
    ]
    return filtered[:limit]


def get_recent_controlled_substances_for_account(
    account_number: str,
    limit: int = 10,
) -> List[ControlledSubstanceItem]:
    """
    Stubbed account-level history for controlled substances.

    In a real system this would query order history / CSF history for the given
    account and return the most commonly or most recently ordered controlled
    substance items.

    For now, we return a stable subset of the mock catalog so the UI can show
    a realistic "Recent for this account" section.
    """
    # For the sandbox, we ignore account_number and just return the first N
    # items from the mock list.
    return MOCK_CONTROLLED_SUBSTANCES[:limit]
