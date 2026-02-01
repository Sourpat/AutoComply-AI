from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.core.db import get_raw_connection


FORM_SPEC_MAP = {
    "csf": "spec_csf",
    "csf_practitioner": "spec_csf",
    "csf_facility": "spec_csf",
    "csf_hospital": "spec_csf",
    "csf_researcher": "spec_csf",
    "csf_ems": "spec_csf",
    "ohio_tddd": "spec_license",
    "license": "spec_license",
}


DEMO_SPECS = [
    {
        "spec_id": "spec_csf",
        "name": "CSF Practitioner Spec",
        "version": 1,
        "status": "active",
        "effective_at": "2026-01-01T00:00:00Z",
        "regulation_ref": "OH-CSF-10.1",
        "snippet": "Ensure practitioner credentials and shipping state are consistent.",
    },
    {
        "spec_id": "spec_csf",
        "name": "CSF Practitioner Spec",
        "version": 2,
        "status": "active",
        "effective_at": "2026-02-01T00:00:00Z",
        "regulation_ref": "OH-CSF-10.1",
        "snippet": "Updated CSF guidance: confirm credentials, shipping state, and scope alignment.",
    },
    {
        "spec_id": "spec_license",
        "name": "License Validation Spec",
        "version": 1,
        "status": "active",
        "effective_at": "2026-01-01T00:00:00Z",
        "regulation_ref": "DEA-REG-1301",
        "snippet": "Validate license status, expiration, and jurisdiction alignment.",
    },
]


DEMO_RULES = [
    {
        "rule_id": "RULE-CSF-001-A",
        "spec_id": "spec_csf",
        "rule_version": 1,
        "severity": "high",
        "conditions_json": json.dumps({"field": "state_license_number", "required": True}),
        "mapping_json": json.dumps({"mapsTo": "caseSnapshot.formType"}),
    },
    {
        "rule_id": "RULE-CSF-001-B",
        "spec_id": "spec_csf",
        "rule_version": 1,
        "severity": "medium",
        "conditions_json": json.dumps({"field": "dea_number", "required": True}),
        "mapping_json": json.dumps({"mapsTo": "caseSnapshot"}),
    },
    {
        "rule_id": "RULE-LIC-001-A",
        "spec_id": "spec_license",
        "rule_version": 1,
        "severity": "high",
        "conditions_json": json.dumps({"field": "expiration_date", "status": "active"}),
        "mapping_json": json.dumps({"mapsTo": "decision"}),
    },
    {
        "rule_id": "RULE-LIC-001-B",
        "spec_id": "spec_license",
        "rule_version": 1,
        "severity": "medium",
        "conditions_json": json.dumps({"field": "ship_to_state", "required": True}),
        "mapping_json": json.dumps({"mapsTo": "caseSnapshot"}),
    },
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_json(value: Optional[str]) -> Optional[Dict[str, Any]]:
    if not value:
        return None
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        return None
    return None


def ensure_demo_specs() -> None:
    now = _now_iso()
    latest_specs: Dict[str, Dict[str, Any]] = {}
    for spec in DEMO_SPECS:
        current = latest_specs.get(spec["spec_id"])
        if not current or spec["version"] > current["version"]:
            latest_specs[spec["spec_id"]] = spec
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        for spec in DEMO_SPECS:
            cursor.execute(
                """
                INSERT INTO spec_registry_versions (
                    spec_id, name, version, status, effective_at,
                    regulation_ref, snippet, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(spec_id, version) DO UPDATE SET
                    name = excluded.name,
                    version = excluded.version,
                    status = excluded.status,
                    effective_at = excluded.effective_at,
                    regulation_ref = excluded.regulation_ref,
                    snippet = excluded.snippet,
                    updated_at = excluded.updated_at
                """,
                (
                    spec["spec_id"],
                    spec["name"],
                    spec["version"],
                    spec["status"],
                    spec["effective_at"],
                    spec["regulation_ref"],
                    spec["snippet"],
                    now,
                    now,
                ),
            )
        for spec in latest_specs.values():
            cursor.execute(
                """
                INSERT INTO spec_registry (
                    spec_id, name, version, status, effective_at,
                    regulation_ref, snippet, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(spec_id) DO UPDATE SET
                    name = excluded.name,
                    version = excluded.version,
                    status = excluded.status,
                    effective_at = excluded.effective_at,
                    regulation_ref = excluded.regulation_ref,
                    snippet = excluded.snippet,
                    updated_at = excluded.updated_at
                """,
                (
                    spec["spec_id"],
                    spec["name"],
                    spec["version"],
                    spec["status"],
                    spec["effective_at"],
                    spec["regulation_ref"],
                    spec["snippet"],
                    now,
                    now,
                ),
            )
        for rule in DEMO_RULES:
            cursor.execute(
                """
                INSERT INTO spec_rules (
                    rule_id, spec_id, rule_version, severity,
                    conditions_json, mapping_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(rule_id) DO UPDATE SET
                    spec_id = excluded.spec_id,
                    rule_version = excluded.rule_version,
                    severity = excluded.severity,
                    conditions_json = excluded.conditions_json,
                    mapping_json = excluded.mapping_json,
                    updated_at = excluded.updated_at
                """,
                (
                    rule["rule_id"],
                    rule["spec_id"],
                    rule["rule_version"],
                    rule["severity"],
                    rule["conditions_json"],
                    rule["mapping_json"],
                    now,
                ),
            )
        conn.commit()


def get_latest_spec(spec_id: str) -> Optional[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT spec_id, name, version, status, effective_at,
                   regulation_ref, snippet, created_at, updated_at
            FROM spec_registry
            WHERE spec_id = ?
            ORDER BY version DESC
            LIMIT 1
            """,
            (spec_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_spec_version(spec_id: str, version: int) -> Optional[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT spec_id, name, version, status, effective_at,
                   regulation_ref, snippet, created_at, updated_at
            FROM spec_registry_versions
            WHERE spec_id = ? AND version = ?
            LIMIT 1
            """,
            (spec_id, version),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_latest_spec_version(spec_id: str) -> Optional[int]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT MAX(version) AS version
            FROM spec_registry_versions
            WHERE spec_id = ?
            """,
            (spec_id,),
        )
        row = cursor.fetchone()
        if row and row["version"] is not None:
            return int(row["version"])
        return None


def get_rules_for_spec(spec_id: str) -> List[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT rule_id, spec_id, rule_version, severity,
                   conditions_json, mapping_json, updated_at
            FROM spec_rules
            WHERE spec_id = ?
            ORDER BY rule_id
            """,
            (spec_id,),
        )
        return [dict(row) for row in cursor.fetchall()]


def resolve_spec_for_packet(packet: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    case_snapshot = packet.get("caseSnapshot") or {}
    form_type = case_snapshot.get("formType")
    if not isinstance(form_type, str):
        return None

    spec_id = FORM_SPEC_MAP.get(form_type)
    if not spec_id:
        return None

    latest_spec_version = get_latest_spec_version(spec_id)
    spec_version_used = 1 if spec_id == "spec_csf" else latest_spec_version
    spec = None
    if spec_version_used is not None:
        spec = get_spec_version(spec_id, spec_version_used)
    if not spec:
        spec = get_latest_spec(spec_id)
        if not spec:
            return None
        spec_version_used = spec.get("version")
    if latest_spec_version is None and spec.get("version") is not None:
        latest_spec_version = spec.get("version")

    rules = get_rules_for_spec(spec_id)
    rule_ids = [rule["rule_id"] for rule in rules]
    rules_meta = [
        {
            "ruleId": rule["rule_id"],
            "severity": rule["severity"],
            "ruleVersion": rule["rule_version"],
        }
        for rule in rules
    ]

    parsed_conditions = [
        parsed for rule in rules
        if (parsed := _parse_json(rule.get("conditions_json")))
    ]
    mapping_used = [
        parsed for rule in rules
        if (parsed := _parse_json(rule.get("mapping_json")))
    ]

    drift: Optional[bool] = None
    if spec_version_used is not None and latest_spec_version is not None:
        drift = spec_version_used != latest_spec_version

    return {
        "specId": spec["spec_id"],
        "specVersionUsed": spec_version_used,
        "latestSpecVersion": latest_spec_version,
        "drift": drift,
        "regulationRef": spec.get("regulation_ref"),
        "snippet": spec.get("snippet"),
        "ruleIdsUsed": rule_ids,
        "rulesMeta": rules_meta,
        "parsedConditions": parsed_conditions,
        "ruleMappingUsed": mapping_used,
        "constraintsTriggered": [],
    }
