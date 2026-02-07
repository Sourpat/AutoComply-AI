from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Iterable

FIRST_TOUCH_HOURS = 4
NEEDS_INFO_HOURS = 48
DECISION_HOURS = 72
DUE_SOON_HOURS = 6

ESCALATION_LEVELS = [
    {"level": 1, "overdue_hours": 0},
    {"level": 2, "overdue_hours": 24},
    {"level": 3, "overdue_hours": 72},
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def add_hours(base_time: datetime, hours: int) -> datetime:
    return base_time + timedelta(hours=hours)


def add_hours_iso(base_time: datetime, hours: int) -> str:
    return add_hours(base_time, hours).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def escalation_level_for_overdue(overdue_hours: float) -> int:
    level = 0
    for item in ESCALATION_LEVELS:
        if overdue_hours >= item["overdue_hours"]:
            level = item["level"]
    return level


def is_due_soon(due_at: str | None, now: datetime | None = None) -> bool:
    if not due_at:
        return False
    now = now or utc_now()
    due = parse_iso(due_at)
    delta = due - now
    if delta.total_seconds() <= 0:
        return False
    return delta.total_seconds() <= DUE_SOON_HOURS * 3600


def is_overdue(due_at: str | None, now: datetime | None = None) -> bool:
    if not due_at:
        return False
    now = now or utc_now()
    due = parse_iso(due_at)
    return now > due


def overdue_hours(due_at: str, now: datetime | None = None) -> float:
    now = now or utc_now()
    due = parse_iso(due_at)
    delta = now - due
    return delta.total_seconds() / 3600


def any_due_soon(due_list: Iterable[str | None], now: datetime | None = None) -> bool:
    return any(is_due_soon(due_at, now=now) for due_at in due_list)


def any_overdue(due_list: Iterable[str | None], now: datetime | None = None) -> bool:
    return any(is_overdue(due_at, now=now) for due_at in due_list)
