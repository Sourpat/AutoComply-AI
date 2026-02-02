from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional

from src.api.models.decision import DecisionOutcome, DecisionStatus
from src.policy.integration import apply_policy
from src.policy.overrides import apply_policy_override, get_policy_override_for_trace

DecisionEngineFamily = Literal["csf", "license", "order"]


@dataclass
class DecisionAuditEntry:
    """
    A single decision event recorded for a trace.

    This is intentionally small and serializable; it can later be moved to a DB or
    external log sink without changing the public API.
    """

    event_type: Optional[str]
    trace_id: str
    engine_family: DecisionEngineFamily
    decision_type: str
    status: str
    reason: str
    risk_level: Optional[str]
    override: Optional[Dict[str, str]]
    policy_contract_version_used: Optional[str]
    created_at: datetime
    decision: DecisionOutcome


@dataclass
class DecisionTraceSummary:
    trace_id: str
    last_updated: datetime
    last_status: DecisionStatus
    engine_families: list[str]


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

        decision = apply_policy(decision, decision_type=decision_type)
        override = get_policy_override_for_trace(trace_id)
        if override:
            decision = apply_policy_override(decision, override)

        policy_contract_version_used: Optional[str] = None
        policy_trace = decision.policy_trace
        if isinstance(policy_trace, dict):
            used_value = policy_trace.get("contract_version_used")
            if used_value is not None:
                policy_contract_version_used = str(used_value)

        entry = DecisionAuditEntry(
            event_type="decision_recorded",
            trace_id=trace_id,
            engine_family=engine_family,
            decision_type=decision_type,
            status=decision.status.value if hasattr(decision.status, "value") else str(decision.status),
            reason=decision.reason,
            risk_level=decision.risk_level,
            override=override,
            policy_contract_version_used=policy_contract_version_used,
            created_at=datetime.now(timezone.utc),
            decision=decision,
        )
        self._by_trace.setdefault(trace_id, []).append(entry)

    def record_policy_override(
        self,
        *,
        trace_id: str,
        override: Dict[str, str],
        before_status: Optional[str],
        after_status: Optional[str],
    ) -> None:
        if not trace_id:
            return

        entries = self._by_trace.get(trace_id, [])
        last_entry = entries[-1] if entries else None

        if last_entry is not None:
            decision = last_entry.decision.model_copy(deep=True)
            engine_family = last_entry.engine_family
            decision_type = last_entry.decision_type
            risk_level = last_entry.risk_level
        else:
            decision = DecisionOutcome(
                status=DecisionStatus.NEEDS_REVIEW,
                reason="Policy override applied",
                trace_id=trace_id,
            )
            engine_family = "csf"
            decision_type = "unknown"
            risk_level = None

        override_payload = {
            **override,
            "before_status": before_status,
            "after_status": after_status,
        }

        decision = apply_policy_override(decision, override_payload)

        entry = DecisionAuditEntry(
            event_type="policy_override_applied",
            trace_id=trace_id,
            engine_family=engine_family,
            decision_type=decision_type,
            status=decision.status.value if hasattr(decision.status, "value") else str(decision.status),
            reason=decision.reason,
            risk_level=risk_level,
            override=override_payload,
            policy_contract_version_used=getattr(last_entry, "policy_contract_version_used", None) if last_entry else None,
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

    def get_recent_traces(self, limit: int = 20) -> list[DecisionTraceSummary]:
        """
        Return a list of recent traces ordered by last_updated descending.

        This does not change underlying storage; it's a read-only view for APIs.
        """

        summaries: list[DecisionTraceSummary] = []

        for trace_id, entries in self._by_trace.items():
            if not entries:
                continue

            last_entry = entries[-1]
            updated_at = (
                getattr(last_entry, "created_at", None)
                or getattr(last_entry, "timestamp", None)
                or datetime.now(timezone.utc)
            )
            last_status = last_entry.decision.status
            engine_families = sorted({entry.engine_family for entry in entries})

            summaries.append(
                DecisionTraceSummary(
                    trace_id=trace_id,
                    last_updated=updated_at,
                    last_status=last_status,
                    engine_families=engine_families,
                )
            )

        summaries.sort(key=lambda s: s.last_updated, reverse=True)
        return summaries[:limit]


# --- Singleton helpers --------------------------------------------------------

_LOG_SINGLETON = DecisionLog()


def get_decision_log() -> DecisionLog:
    return _LOG_SINGLETON
