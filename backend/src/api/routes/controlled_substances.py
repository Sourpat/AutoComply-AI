from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from autocomply.domain.controlled_substances_catalog import (
    get_history_for_account,
    search_controlled_substances,
)

router = APIRouter(
    prefix="/controlled-substances",
    tags=["controlled_substances"],
)


class ControlledSubstance(BaseModel):
    id: str
    name: str
    strength: Optional[str] = None
    unit: Optional[str] = None
    schedule: Optional[str] = None
    dea_code: Optional[str] = None


class ControlledSubstanceHistoryItem(ControlledSubstance):
    account_number: Optional[str] = None
    last_ordered_at: Optional[str] = Field(
        default=None,
        description="ISO date string (YYYY-MM-DD) of last order, if known.",
    )


@router.get("/search", response_model=List[ControlledSubstance])
async def search_endpoint(
    q: str = Query(..., min_length=2, description="Free-text search query"),
) -> List[ControlledSubstance]:
    """
    Live search for controlled substances by name or DEA code.
    """
    results = search_controlled_substances(q)
    return [
        ControlledSubstance(**{
            "id": item.id,
            "name": item.name,
            "strength": item.strength,
            "unit": item.unit,
            "schedule": item.schedule,
            "dea_code": item.dea_code,
        })
        for item in results
    ]


@router.get("/history", response_model=List[ControlledSubstanceHistoryItem])
async def history_endpoint(
    account_number: str = Query(
        ...,
        min_length=1,
        description="Account number to fetch recent controlled substance items for.",
    ),
) -> List[ControlledSubstanceHistoryItem]:
    """
    Returns recent controlled substances ordered for a given account number.
    """
    items = get_history_for_account(account_number)
    return [
        ControlledSubstanceHistoryItem(**{
            "id": item.id,
            "name": item.name,
            "strength": item.strength,
            "unit": item.unit,
            "schedule": item.schedule,
            "dea_code": item.dea_code,
            "account_number": item.account_number,
            "last_ordered_at": (
                item.last_ordered_at.isoformat()
                if item.last_ordered_at is not None
                else None
            ),
        })
        for item in items
    ]
