from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.api.routes.rag_regulatory import ExplainV1Request, build_explain_contract_v1
from src.autocomply.domain.explainability.claim_gate import _DISALLOWED_MARKERS
from src.autocomply.domain.explainability.models import ExplainResult

DEFAULT_GOLDEN_VERSION = "v1"


def _golden_root() -> Path:
    return Path(__file__).resolve().parents[4] / "golden_cases"


def load_golden_cases(
    version: str = DEFAULT_GOLDEN_VERSION,
    base_dir: Optional[Path] = None,
) -> List[Dict[str, Any]]:
    root = base_dir or _golden_root()
    case_dir = root / version
    if not case_dir.exists():
        return []

    cases: List[Dict[str, Any]] = []
    for path in sorted(case_dir.glob("*.json")):
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        if isinstance(payload, dict):
            payload.setdefault("_file", str(path))
            cases.append(payload)
    return cases


def _validate_case(case: Dict[str, Any], result: ExplainResult) -> List[str]:
    expect = case.get("expect") or {}
    errors: List[str] = []

    expected_status = expect.get("status")
    if expected_status and result.status != expected_status:
        errors.append(f"status_expected_{expected_status}_got_{result.status}")

    expected_risk = expect.get("risk")
    if expected_risk and result.risk != expected_risk:
        errors.append(f"risk_expected_{expected_risk}_got_{result.risk}")

    must_include_rules = expect.get("must_include_rules") or []
    fired_rule_ids = {rule.id for rule in result.fired_rules}
    for rule_id in must_include_rules:
        if rule_id not in fired_rule_ids:
            errors.append(f"missing_rule_{rule_id}")

    must_include_missing_keys = expect.get("must_include_missing_keys") or []
    missing_keys = {field.key for field in result.missing_fields}
    for key in must_include_missing_keys:
        if key not in missing_keys:
            errors.append(f"missing_field_{key}")

    must_not_claim_when_no_citations = bool(expect.get("must_not_claim_when_no_citations"))
    if must_not_claim_when_no_citations and not result.citations:
        summary = (result.summary or "").lower()
        for marker in _DISALLOWED_MARKERS:
            if marker in summary:
                errors.append(f"summary_contains_marker_{marker}")
                break

    return errors


async def run_golden_suite(
    version: str = DEFAULT_GOLDEN_VERSION,
    base_dir: Optional[Path] = None,
) -> Dict[str, Any]:
    cases = load_golden_cases(version=version, base_dir=base_dir)
    results: List[Dict[str, Any]] = []
    failures: List[Dict[str, Any]] = []

    if not cases:
        return {
            "ok": False,
            "total": 0,
            "passed": 0,
            "failed": 0,
            "failures": [{"case_id": "_suite", "errors": ["no_cases_loaded"]}],
            "cases": [],
        }

    for case in cases:
        case_id = case.get("id") or case.get("_file") or "unknown"
        try:
            submission_type = case.get("submission_type")
            submission = case.get("submission") or {}
            request = ExplainV1Request(
                submission_type=submission_type,
                payload=submission,
            )
            result = await build_explain_contract_v1(
                request,
                request_id=f"golden-{case_id}",
            )
            errors = _validate_case(case, result)
            case_result = {
                "case_id": case_id,
                "ok": not errors,
                "status": result.status,
                "risk": result.risk,
                "errors": errors,
            }
            results.append(case_result)
            if errors:
                failures.append({"case_id": case_id, "errors": errors})
        except Exception as exc:
            error_msg = f"exception_{type(exc).__name__}"
            results.append({"case_id": case_id, "ok": False, "errors": [error_msg]})
            failures.append({"case_id": case_id, "errors": [error_msg]})

    total = len(results)
    failed = len(failures)
    passed = total - failed

    return {
        "ok": failed == 0,
        "total": total,
        "passed": passed,
        "failed": failed,
        "failures": failures,
        "cases": results,
    }
