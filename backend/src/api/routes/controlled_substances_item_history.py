from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Query

from src.domain.controlled_substances_item_history import search_item_history

router = APIRouter(
    prefix="/controlled-substances/item-history",
    tags=["controlled_substances"],
)


@router.get("/search", response_model=List[Dict[str, Any]])
def search_controlled_substances_item_history(
    query: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
) -> List[Dict[str, Any]]:
    """
    Search stubbed controlled-substances item history by item ID or name.

    This is a demo endpoint used by the sandbox UI to show how
    a verification / compliance team could quickly pull item-level
    history (schedule, last decisions, flags) while reviewing forms.
    """
    return search_item_history(query=query, limit=limit)
