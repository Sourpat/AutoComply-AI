from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from src.api.models.decision import DecisionOutcome

DecisionEngineFamily = Literal["csf", "license", "order"]


@dataclass
class DecisionAuditEntry:
    """
    A single decision event recorded for a trace.

    This is intentionally small and serializable; it can later be moved to a DB or
    external log sink without changing the public API.
    """

    trace_id: str
    engine_family: DecisionEngineFamily
    decision_type: str
    status: str
    reason: str
    risk_level: Optional[str]
    created_at: datetime
    decision: DecisionOutcome


class DecisionLog:
    """
    In-memory decision audit log keyed by trace_id.

    V1: per-process, non-persistent.
    V2: can be backed by a database, message bus, or external log service.
    """

    def __init__(self) -> None:
        self._by_trace: Dict[str, List[DecisionAuditEntry]] = {}

    def record(
        self,
        *,
        trace_id: str,
        engine_family: DecisionEngineFamily,
        decision_type: str,
        decision: DecisionOutcome,
    ) -> None:
        if not trace_id:
            # We only log meaningful traces; anonymous decisions can be skipped.
            return

        entry = DecisionAuditEntry(
            trace_id=trace_id,
            engine_family=engine_family,
            decision_type=decision_type,
            status=decision.status.value if hasattr(decision.status, "value") else str(decision.status),
            reason=decision.reason,
            risk_level=decision.risk_level,
            created_at=datetime.now(timezone.utc),
            decision=decision,
        )
        self._by_trace.setdefault(trace_id, []).append(entry)

    def get_by_trace(self, trace_id: str) -> List[DecisionAuditEntry]:
        return list(self._by_trace.get(trace_id, []))

    def get_entries_for_trace(self, trace_id: str) -> List[DecisionAuditEntry]:
        """Alias for get_by_trace for clearer intent in newer APIs."""

        return self.get_by_trace(trace_id)

    def clear(self) -> None:
        """Remove all recorded decision entries (primarily for tests)."""

        self._by_trace.clear()


# --- Singleton helpers --------------------------------------------------------

_LOG_SINGLETON = DecisionLog()


def get_decision_log() -> DecisionLog:
    return _LOG_SINGLETON
