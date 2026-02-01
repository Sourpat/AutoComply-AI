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


def _unknown_intent(
    reason: str,
    spec_id: Optional[str],
    decision_id: Optional[str],
    decision_status: Optional[str],
    decision_risk: Optional[str],
) -> Dict[str, Any]:
    return {
        "intent": "unknown",
        "sourceRef": {"specId": spec_id, "decisionId": decision_id},
        "reason": reason,
        "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
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
            "executionIntents": [_unknown_intent("Packet data unavailable.", None, None, None, None)],
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

    intents: List[Dict[str, Any]] = []
    status_lower = decision_status.lower() if decision_status else ""
    block_statuses = {"rejected", "deny", "blocked"}
    review_statuses = {"needs_review", "flagged", "manual_review"}

    if status_lower in block_statuses:
        intents.append({
            "intent": "block",
            "sourceRef": {"specId": spec_id, "decisionId": decision_id},
            "reason": "Decision status indicates a block.",
            "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
        })
    if status_lower in review_statuses:
        intents.append({
            "intent": "manual_review",
            "sourceRef": {"specId": spec_id, "decisionId": decision_id},
            "reason": "Decision status requires manual review.",
            "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
        })

    has_human_events = bool(human_events)
    if has_human_events or override_present:
        intents.append({
            "intent": "emit_audit_event",
            "sourceRef": {"specId": spec_id, "decisionId": decision_id},
            "reason": "Human-in-the-loop or audit event recorded.",
            "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
        })

    risk_lower = decision_risk.lower() if decision_risk else ""
    if risk_lower in {"high", "medium"}:
        if status_lower in review_statuses:
            intents.append({
                "intent": "display_warning",
                "sourceRef": {"specId": spec_id, "decisionId": decision_id},
                "reason": "Medium/high risk requires warning during review.",
                "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
            })
        elif status_lower in block_statuses:
            intents.append({
                "intent": "apply_restriction",
                "sourceRef": {"specId": spec_id, "decisionId": decision_id},
                "reason": "Medium/high risk requires restriction for blocked outcomes.",
                "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
            })
        else:
            intents.append({
                "intent": "display_warning",
                "sourceRef": {"specId": spec_id, "decisionId": decision_id},
                "reason": "Medium/high risk requires warning.",
                "outcome": {"decisionStatus": decision_status, "riskLevel": decision_risk},
            })

    if not intents:
        intents.append(_unknown_intent("Decision data unavailable.", spec_id, decision_id, decision_status, decision_risk))

    affected_system_ids = set()
    for intent in intents:
        intent_name = _as_str(intent.get("intent")) or "unknown"
        if intent_name in {"block", "manual_review"}:
            affected_system_ids.add("workflow")
        if intent_name == "display_warning":
            affected_system_ids.add("ui")
        if intent_name == "emit_audit_event":
            affected_system_ids.add("audit")
        if intent_name == "apply_restriction":
            affected_system_ids.add("compliance")
        if intent_name == "unknown":
            affected_system_ids.add("unknown")

    affected_systems: List[Dict[str, Any]] = []
    labels = {
        "workflow": "Workflow decision",
        "ui": "User interface",
        "audit": "Audit packet",
        "compliance": "Compliance policy",
        "unknown": "Unknown system",
    }
    for system_id in sorted(affected_system_ids):
        affected_systems.append({"id": system_id, "label": labels.get(system_id, "Unknown system")})

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