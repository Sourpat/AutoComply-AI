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


def _ui_impacts_for_intent(intent: str) -> Dict[str, Any]:
    mapping = {
        "block": {
            "impacts": ["blocking_modal", "disabled_action", "informational_copy"],
            "note": "Blocked outcomes require UI blocking and guidance.",
        },
        "manual_review": {
            "impacts": ["badge_warning", "informational_copy"],
            "note": "Review-required outcomes display warnings and guidance.",
        },
        "display_warning": {
            "impacts": ["badge_warning", "inline_validation", "informational_copy"],
            "note": "Warning outcomes show badges and inline validation.",
        },
        "apply_restriction": {
            "impacts": ["disabled_action", "informational_copy"],
            "note": "Restricted outcomes disable actions with guidance.",
        },
        "emit_audit_event": {
            "impacts": ["none"],
            "note": "Audit event intents do not require UI change.",
        },
        "unknown": {
            "impacts": ["unknown"],
            "note": "UI impact mapping unavailable.",
        },
    }
    return mapping.get(intent, mapping["unknown"])


def _select_primary_ui_impact(impacts: List[str]) -> str:
    priority = [
        "blocking_modal",
        "disabled_action",
        "badge_warning",
        "inline_validation",
        "informational_copy",
        "none",
        "unknown",
    ]
    for impact in priority:
        if impact in impacts:
            return impact
    return "unknown"


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

    ui_impacts: List[Dict[str, Any]] = []
    unique_ui_impacts: List[str] = []
    for intent in intents:
        intent_name = _as_str(intent.get("intent")) or "unknown"
        ui_data = _ui_impacts_for_intent(intent_name)
        intent["uiImpacts"] = ui_data["impacts"]
        intent["uiNote"] = ui_data["note"]
        for impact in ui_data["impacts"]:
            if impact not in unique_ui_impacts:
                unique_ui_impacts.append(impact)
        if intent_name == "unknown":
            ui_impacts = []
        else:
            for impact in ui_data["impacts"]:
                ui_impacts.append({
                    "type": impact,
                    "linkedIntent": intent_name,
                    "notes": ui_data["note"],
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

    ui_impacts_summary = {
        "impacts": unique_ui_impacts,
        "primary": _select_primary_ui_impact(unique_ui_impacts),
    }

    missing_signals: List[str] = []
    if not intents or all((_as_str(intent.get("intent")) or "unknown") == "unknown" for intent in intents):
        missing_signals.append("execution_intents")

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
        "ui_impacts_summary": ui_impacts_summary,
        "auditImpacts": audit_impacts,
        "missingSignals": missing_signals,
        "readiness": {
            "missing": sorted(set(missing)),
            "status": readiness_status,
        },
    }