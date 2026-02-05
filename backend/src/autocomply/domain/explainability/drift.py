from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

ENGINE_VERSION = "explain-engine-v1"


DriftReason = Literal["policy", "knowledge", "engine", "input", "unknown"]


@dataclass(frozen=True)
class DriftResult:
    changed: bool
    reason: DriftReason
    fields_changed: List[str]


def _payload_debug(run: Dict[str, Any]) -> Dict[str, Any]:
    payload = run.get("payload") or {}
    debug = payload.get("debug") if isinstance(payload, dict) else None
    return debug if isinstance(debug, dict) else {}


def _engine_version(run: Dict[str, Any]) -> Optional[str]:
    debug = _payload_debug(run)
    value = debug.get("engine_version")
    return str(value) if value else None


def _missing_field_keys(run: Dict[str, Any]) -> set[str]:
    payload = run.get("payload") or {}
    missing = payload.get("missing_fields") if isinstance(payload, dict) else []
    keys: set[str] = set()
    for item in missing or []:
        if not isinstance(item, dict):
            continue
        keys.add(f"{item.get('key','')}:{item.get('category','')}")
    return keys


def _fired_rule_ids(run: Dict[str, Any]) -> set[str]:
    payload = run.get("payload") or {}
    fired = payload.get("fired_rules") if isinstance(payload, dict) else []
    ids: set[str] = set()
    for item in fired or []:
        if not isinstance(item, dict):
            continue
        rule_id = item.get("id")
        if rule_id:
            ids.add(str(rule_id))
    return ids


def detect_drift(run_a: Dict[str, Any], run_b: Dict[str, Any]) -> DriftResult:
    fields_changed: List[str] = []

    if run_a.get("submission_hash") != run_b.get("submission_hash"):
        fields_changed.append("submission_hash")
        return DriftResult(True, "input", fields_changed)

    if run_a.get("policy_version") != run_b.get("policy_version"):
        fields_changed.append("policy_version")
        return DriftResult(True, "policy", fields_changed)

    if run_a.get("knowledge_version") != run_b.get("knowledge_version"):
        fields_changed.append("knowledge_version")
        return DriftResult(True, "knowledge", fields_changed)

    if _engine_version(run_a) != _engine_version(run_b):
        fields_changed.append("engine_version")
        return DriftResult(True, "engine", fields_changed)

    if run_a.get("status") != run_b.get("status"):
        fields_changed.append("status")
    if run_a.get("risk") != run_b.get("risk"):
        fields_changed.append("risk")
    if _missing_field_keys(run_a) != _missing_field_keys(run_b):
        fields_changed.append("missing_fields")
    if _fired_rule_ids(run_a) != _fired_rule_ids(run_b):
        fields_changed.append("fired_rules")

    if fields_changed:
        return DriftResult(True, "unknown", fields_changed)

    return DriftResult(False, "unknown", [])
