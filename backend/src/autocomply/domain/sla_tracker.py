from __future__ import annotations

from datetime import datetime
from typing import Iterable

from src.autocomply.domain.sla_policy import is_due_soon, is_overdue


def _due_soon(due_at: str | None, now: datetime) -> bool:
    return is_due_soon(due_at, now=now)


def _overdue(due_at: str | None, now: datetime) -> bool:
    return is_overdue(due_at, now=now)


def compute_sla_stats(submissions: Iterable[object], now: datetime) -> dict:
    verifier_due_soon = 0
    verifier_overdue = 0
    needs_info_due_soon = 0
    needs_info_overdue = 0
    decision_due_soon = 0
    decision_overdue = 0

    for submission in submissions:
        first_touch_due_at = getattr(submission, "sla_first_touch_due_at", None)
        needs_info_due_at = getattr(submission, "sla_needs_info_due_at", None)
        decision_due_at = getattr(submission, "sla_decision_due_at", None)

        first_touch_due_soon = _due_soon(first_touch_due_at, now)
        first_touch_overdue = _overdue(first_touch_due_at, now)
        decision_due_soon_flag = _due_soon(decision_due_at, now)
        decision_overdue_flag = _overdue(decision_due_at, now)
        needs_info_due_soon_flag = _due_soon(needs_info_due_at, now)
        needs_info_overdue_flag = _overdue(needs_info_due_at, now)

        if first_touch_due_soon or decision_due_soon_flag:
            verifier_due_soon += 1
        if first_touch_overdue or decision_overdue_flag:
            verifier_overdue += 1

        if needs_info_due_soon_flag:
            needs_info_due_soon += 1
        if needs_info_overdue_flag:
            needs_info_overdue += 1

        if decision_due_soon_flag:
            decision_due_soon += 1
        if decision_overdue_flag:
            decision_overdue += 1

    return {
        "verifier_due_soon": verifier_due_soon,
        "verifier_overdue": verifier_overdue,
        "needs_info_due_soon": needs_info_due_soon,
        "needs_info_overdue": needs_info_overdue,
        "decision_due_soon": decision_due_soon,
        "decision_overdue": decision_overdue,
    }
