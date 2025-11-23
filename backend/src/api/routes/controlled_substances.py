from typing import List

from fastapi import APIRouter, Query

from autocomply.domain.controlled_substances import (
    ControlledSubstanceItem,
    get_recent_controlled_substances_for_account,
    search_controlled_substances,
)

router = APIRouter(
    prefix="/controlled-substances",
    tags=["controlled_substances"],
)


@router.get("/search", response_model=List[ControlledSubstanceItem])
async def search_controlled_substances_endpoint(
    q: str = Query("", description="Free-text query (name or NDC)."),
    limit: int = Query(10, ge=1, le=50),
) -> List[ControlledSubstanceItem]:
    """
    Lightweight, catalog-agnostic search for controlled substance items.

    This is intentionally simple and can be swapped out later to call a real
    catalog search API. For now, returns matches from a small mock set.
    """

    return search_controlled_substances(query=q, limit=limit)


@router.get("/history", response_model=List[ControlledSubstanceItem])
async def controlled_substances_history_endpoint(
    account_number: str = Query(
        ..., description="Account number for which to load recent controlled substances."
    ),
    limit: int = Query(10, ge=1, le=50),
) -> List[ControlledSubstanceItem]:
    """
    Return recent controlled substance items for a given account.

    For now this is backed by a mock implementation but has the same shape
    as the normal search results so the UI can treat them uniformly.
    """
    return get_recent_controlled_substances_for_account(
        account_number=account_number,
        limit=limit,
    )
