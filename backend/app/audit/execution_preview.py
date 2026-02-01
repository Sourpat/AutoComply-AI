from __future__ import annotations

from typing import Any, Dict, List, Optional


def _as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _as_str(value: Any) -> Optional[str]:
    return value if isinstance(value, str) else None


def _as_float(value: Any) -> Optional[float]:
    return float(value) if isinstance(value, (int, float)) else None


def _unknown_intent(reason: str, spec_id: Optional[str], decision_id: Optional[str]) -> Dict[str, Any]:
    return {
        "intent": "unknown",
        "sourceRef": {"specId": spec_id, "decisionId": decision_id},
        "reason": reason,
    }


def _unknown_ui_impact(intent: str) -> Dict[str, Any]:
    return {
        "type": "unknown",
        "linkedIntent": intent,
        "notes": "UI impact mapping unavailable.",
    }


def _unknown_audit_impact() -> Dict[str, Any]:
    return {
        "type": "unknown",
        "notes": "Audit impact mapping unavailable.",
    }


def build_execution_preview(packet: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(packet, dict):
        return {
            "version": "v1",
            "source": {
                "spec": {"specId": None, "versionUsed": None, "latestVersion": None},
                "decision": {"status": None, "riskLevel": None, "confidence": None},
                "override": {"hasOverride": None},
            },
            "affectedSystems": [{"id": "unknown", "label": "Unknown system"}],
            "executionIntents": [_unknown_intent("Packet data unavailable.", None, None)],
            "uiImpacts": [_unknown_ui_impact("unknown")],
            "auditImpacts": [_unknown_audit_impact()],
            "readiness": {
                "missing": ["spec", "decision_trace", "ui_mapping", "audit_hooks", "override_coverage"],
                "status": "unknown",
            },
        }

    decision_trace = _as_dict(packet.get("decision_trace"))
    spec = _as_dict(decision_trace.get("spec"))
    decision = _as_dict(packet.get("decision"))
    metadata = _as_dict(packet.get("metadata"))
    human_actions = _as_dict(packet.get("humanActions"))
    human_events = _as_list(human_actions.get("events"))

    spec_id = _as_str(spec.get("specId"))
    spec_version = spec.get("specVersionUsed")
    latest_version = spec.get("latestSpecVersion")

    decision_status = _as_str(decision.get("status"))
    decision_risk = _as_str(decision.get("riskLevel"))
    decision_confidence = _as_float(decision.get("confidence"))
    decision_id = _as_str(decision.get("decisionId")) or _as_str(metadata.get("decisionId"))

    override_present: Optional[bool]
    if human_events:
        override_present = any(
            _as_str(event.get("type")) in {"override_feedback", "OVERRIDE_DECISION"}
            for event in human_events
        )
    else:
        override_present = None

    affected_systems: List[Dict[str, Any]] = []
    if spec_id:
        affected_systems.append({"id": "compliance", "label": "Compliance spec mapping"})
    if decision_status:
        affected_systems.append({"id": "workflow", "label": "Workflow decision"})
    if packet.get("packetHash"):
        affected_systems.append({"id": "audit", "label": "Audit packet"})

    intents: List[Dict[str, Any]] = []
    status_lower = decision_status.lower() if decision_status else ""
    if decision_status:
        if "block" in status_lower or "reject" in status_lower:
            intents.append({
                "intent": "block",
                "sourceRef": {"specId": spec_id, "decisionId": decision_id},
                "reason": "Decision status indicates a block.",
            })
        elif "needs_review" in status_lower or "queued_review" in status_lower or "review" in status_lower:
            intents.append({
                "intent": "manual_review",
                "sourceRef": {"specId": spec_id, "decisionId": decision_id},
                "reason": "Decision status requires manual review.",
            })
        elif "approved" in status_lower or "allow" in status_lower:
            intents.append({
                "intent": "emit_audit_event",
                "sourceRef": {"specId": spec_id, "decisionId": decision_id},
                "reason": "Decision status recorded for audit trail.",
            })
        else:
            intents.append(_unknown_intent("Decision status not mapped.", spec_id, decision_id))

    if decision_risk and decision_risk.lower() in {"high", "medium", "critical"}:
        intents.append({
            "intent": "display_warning",
            "sourceRef": {"specId": spec_id, "decisionId": decision_id},
            "reason": "Risk level requires a warning badge.",
        })

    if not intents:
        intents.append(_unknown_intent("Decision data unavailable.", spec_id, decision_id))

    ui_mapping = {
        "block": ("blocking_modal", "UI blocks the action for blocked decisions."),
        "manual_review": ("disabled_action", "UI disables automated actions pending review."),
        "emit_audit_event": ("info_copy", "UI shows audit-ready copy for the decision."),
        "apply_restriction": ("inline_validation", "UI applies inline restriction messaging."),
        "display_warning": ("badge_warning", "UI displays a warning badge for elevated risk."),
        "unknown": ("unknown", "UI impact mapping unavailable."),
    }

    ui_impacts: List[Dict[str, Any]] = []
    for intent in intents:
        intent_name = _as_str(intent.get("intent")) or "unknown"
        impact_type, notes = ui_mapping.get(intent_name, ui_mapping["unknown"])
        ui_impacts.append({
            "type": impact_type,
            "linkedIntent": intent_name,
            "notes": notes,
        })

    if any(impact.get("type") != "unknown" for impact in ui_impacts):
        affected_systems.append({"id": "ui", "label": "User interface"})

    audit_impacts: List[Dict[str, Any]] = []
    if packet.get("packetHash"):
        audit_impacts.append({"type": "packet_hash", "notes": "Packet hash anchors audit integrity."})
    if packet.get("timelineEvents"):
        audit_impacts.append({"type": "event_log", "notes": "Timeline events captured in audit log."})
    if override_present:
        audit_impacts.append({"type": "override_feedback", "notes": "Override feedback recorded."})

    if not audit_impacts:
        audit_impacts.append(_unknown_audit_impact())

    if not affected_systems:
        affected_systems.append({"id": "unknown", "label": "Unknown system"})

    missing: List[str] = []
    if not decision_trace:
        missing.append("decision_trace")
    if not spec_id:
        missing.append("spec")
    if not decision_status:
        missing.append("decision")
    if all(impact.get("type") == "unknown" for impact in ui_impacts):
        missing.append("ui_mapping")
    if all(impact.get("type") == "unknown" for impact in audit_impacts):
        missing.append("audit_hooks")
    if override_present is None:
        missing.append("override_coverage")

    if not missing:
        readiness_status = "complete"
    elif "spec" in missing and "decision_trace" in missing:
        readiness_status = "incomplete"
    elif len(missing) >= 3:
        readiness_status = "incomplete"
    else:
        readiness_status = "partial"

    return {
        "version": "v1",
        "source": {
            "spec": {
                "specId": spec_id,
                "versionUsed": str(spec_version) if spec_version is not None else None,
                "latestVersion": str(latest_version) if latest_version is not None else None,
            },
            "decision": {
                "status": decision_status,
                "riskLevel": decision_risk,
                "confidence": decision_confidence,
            },
            "override": {"hasOverride": override_present},
        },
        "affectedSystems": affected_systems,
        "executionIntents": intents,
        "uiImpacts": ui_impacts,
        "auditImpacts": audit_impacts,
        "readiness": {
            "missing": sorted(set(missing)),
            "status": readiness_status,
        },
    }