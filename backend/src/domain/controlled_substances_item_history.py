from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import date
from typing import List, Dict, Any


@dataclass
class ControlledSubstancesItemHistory:
    item_id: str  # e.g. NDC or internal item code
    name: str
    strength: str  # e.g. "5 mg", "10 mg/mL"
    dosage_form: str  # e.g. "Tablet", "Injection"
    dea_schedule: str  # e.g. "II", "III", "IV", "Non-controlled"
    last_purchase_date: str
    last_ship_to_state: str
    last_decision_status: str  # "allowed" | "blocked" | "manual_review"
    total_orders_12m: int
    verification_flags: List[str]
    # These are /mnt/data/... paths; runtime will map to URLs.
    source_documents: List[str]


# Seed dataset – just enough to make the UI/demo feel real.
# You can expand this later or swap for a real DB.
_ITEMS: List[ControlledSubstancesItemHistory] = [
    ControlledSubstancesItemHistory(
        item_id="NDC-55555-0101",
        name="Oxycodone HCl 5mg Tablet",
        strength="5 mg",
        dosage_form="Tablet",
        dea_schedule="II",
        last_purchase_date=str(date(2025, 1, 15)),
        last_ship_to_state="FL",
        last_decision_status="manual_review",
        total_orders_12m=24,
        verification_flags=[
            "manual_review_due_to_high_frequency",
            "requires_active_DEA_and_state_controlled_substance_license",
        ],
        source_documents=[
            "/mnt/data/Controlled_Substances_Form_Flow_Updated.png",
            "/mnt/data/Controlledsubstance_userflow.png",
        ],
    ),
    ControlledSubstancesItemHistory(
        item_id="NDC-77777-0202",
        name="Hydrocodone/APAP 10mg/325mg Tablet",
        strength="10 mg / 325 mg",
        dosage_form="Tablet",
        dea_schedule="II",
        last_purchase_date=str(date(2025, 3, 2)),
        last_ship_to_state="OH",
        last_decision_status="blocked",
        total_orders_12m=5,
        verification_flags=[
            "blocked_missing_DEA_number",
            "ohio_tddd_required_for_schedule_II",
        ],
        source_documents=[
            "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
            "/mnt/data/Ohio TDDD.html",
        ],
    ),
    ControlledSubstancesItemHistory(
        item_id="SKU-DEXAMETH-1MGML",
        name="Dexamethasone 1mg/mL Injection",
        strength="1 mg/mL",
        dosage_form="Injection",
        dea_schedule="Non-controlled",
        last_purchase_date=str(date(2025, 2, 10)),
        last_ship_to_state="NY",
        last_decision_status="allowed",
        total_orders_12m=42,
        verification_flags=[
            "not_a_controlled_substance",
            "no_csf_required_for_this_item",
        ],
        source_documents=[
            "/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
        ],
    ),
]


def search_item_history(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Very simple substring search over item_id and name.
    Intended as a demo/stub; replace with DB search later.
    """
    q = (query or "").strip().lower()
    if not q:
        return []

    results: List[ControlledSubstancesItemHistory] = []
    for item in _ITEMS:
        haystacks = [item.item_id.lower(), item.name.lower()]
        if any(q in h for h in haystacks):
            results.append(item)
        if len(results) >= limit:
            break

    return [asdict(i) for i in results]
