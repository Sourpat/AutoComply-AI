from __future__ import annotations

from typing import Literal, Tuple

DecisionStatusLiteral = Literal["ok_to_ship", "needs_review", "blocked"]


def compute_risk_for_status(status: DecisionStatusLiteral) -> Tuple[str, float]:
    """
    Map decision status to a simple risk_level / risk_score.

    - ok_to_ship   -> ("low", 0.1)
    - needs_review -> ("medium", 0.5)
    - blocked      -> ("high", 0.9)
    """
    if status == "ok_to_ship":
        return "low", 0.1
    if status == "needs_review":
        return "medium", 0.5
    # default: blocked or unknown treated as high risk
    return "high", 0.9
