"""
Diagnostic script to identify why cases show 0% confidence.

For each case in the store, prints:
- case_id, decision_type, submission/evidence counts
- number of signals
- intelligence_v2 metrics (confidence, gaps, bias)
- diagnosis of why confidence is 0
"""

import sys
sys.path.insert(0, '.')

import json
from typing import Optional
from src.core.db import execute_sql
from app.intelligence.repository import get_signals, get_decision_intelligence
from app.intelligence.service import recompute_case_intelligence


def diagnose_case(case_id: str, decision_type: str) -> dict:
    """Diagnose a single case."""
    
    # Get case details
    try:
        case_row = execute_sql(
            "SELECT id, decision_type, submission_id, status FROM cases WHERE id = :id",
            {"id": case_id}
        )[0]
    except (IndexError, Exception) as e:
        return {
            "case_id": case_id[:8],
            "decision_type": decision_type,
            "diagnosis": "api_error",
            "detail": str(e)[:50]
        }
    
    # Count artifacts
    has_submission = bool(case_row.get("submission_id"))
    
    try:
        attachments = execute_sql(
            "SELECT COUNT(*) as cnt FROM attachments WHERE case_id = :case_id AND is_deleted = 0",
            {"case_id": case_id}
        )
        evidence_count = attachments[0]["cnt"] if attachments else 0
    except:
        evidence_count = 0
    
    # Get signals BEFORE recompute
    signals_before = get_signals(case_id)
    
    # Recompute intelligence
    try:
        recompute_case_intelligence(case_id, decision_type)
    except Exception as e:
        return {
            "case_id": case_id[:8],
            "decision_type": decision_type,
            "diagnosis": "recompute_error",
            "detail": str(e)[:50]
        }
    
    # Get signals AFTER recompute
    signals_after = get_signals(case_id)
    
    # Get intelligence
    try:
        intel = get_decision_intelligence(case_id)
    except:
        intel = None
    
    if not intel:
        return {
            "case_id": case_id[:8],
            "decision_type": decision_type,
            "has_submission": has_submission,
            "evidence_count": evidence_count,
            "signals_before": len(signals_before),
            "signals_after": len(signals_after),
            "confidence": "N/A",
            "diagnosis": "no_intelligence"
        }
    
    # Parse gaps, bias, and rule explanation
    gaps = json.loads(intel.gap_json) if intel.gap_json else []
    bias_flags = json.loads(intel.bias_json) if intel.bias_json else []
    
    # Try to get rule summary from executive_summary_json
    rule_summary = {}
    passed_rules = 0
    total_rules = 0
    critical_failures = 0
    
    try:
        if intel.executive_summary_json:
            exec_summary = json.loads(intel.executive_summary_json)
            if isinstance(exec_summary, dict):
                # Check for rule_validation key (merged structure)
                if "rule_validation" in exec_summary:
                    rule_val = exec_summary["rule_validation"]
                    passed_rules = rule_val.get("passed_rules", 0)
                    total_rules = rule_val.get("total_rules", 0)
                    critical_failures = len(rule_val.get("critical_failures", []))
                    rule_summary = rule_val.get("rule_summary", {})
                # Check for direct rule info at top level (when executive summary gen fails)
                elif "passed_rules" in exec_summary and "total_rules" in exec_summary:
                    passed_rules = exec_summary.get("passed_rules", 0)
                    total_rules = exec_summary.get("total_rules", 0)
                    critical_failures = len(exec_summary.get("critical_failures", []))
                    rule_summary = exec_summary.get("rule_summary", {})
    except:
        pass
    
    # Determine diagnosis
    diagnosis = "ok"
    detail = ""
    
    if intel.confidence_score == 0:
        if len(signals_after) == 0:
            diagnosis = "no_signals"
            detail = "No signals generated"
        elif has_submission and len(signals_after) > 0:
            # Check if submission_completeness signal is 0
            sub_complete_signal = next(
                (s for s in signals_after if "submission_completeness" in (s.metadata_json or "")),
                None
            )
            if sub_complete_signal and sub_complete_signal.signal_strength == 0:
                diagnosis = "expectations_mismatch"
                # Get detailed field comparison
                from app.intelligence.generator import normalize_submission_fields
                sub_result = execute_sql(
                    "SELECT form_data FROM submissions WHERE id = :sub_id",
                    {"sub_id": submission_id}
                )
                if sub_result:
                    raw_data = json.loads(sub_result[0]['form_data'])
                    normalized_data = normalize_submission_fields(decision_type, raw_data)
                    expected_map = {
                        "csf": ["name", "licenseNumber", "specialty", "yearsOfExperience"],
                        "csf_practitioner": ["name", "licenseNumber", "specialty", "yearsOfExperience"],
                        "csa": ["name"],
                    }
                    expected = expected_map.get(decision_type, [])
                    actual_keys = set(k for k, v in normalized_data.items() if v not in (None, "", []))
                    expected_set = set(expected)
                    missing = expected_set - actual_keys
                    extra = actual_keys - expected_set
                    
                    detail = f"Expected: {expected}\\nActual keys: {sorted(list(actual_keys))}"
                    if missing:
                        detail += f"\\nMissing: {sorted(list(missing))}"
                    if extra:
                        top_extra = sorted(list(extra))[:5]
                        detail += f"\\nExtra (top 5): {top_extra}"
                else:
                    detail = "Submission fields don't match expected"
            else:
                diagnosis = "signals_present_but_scoring_zero"
                detail = f"{len(signals_after)} signals, {len(gaps)} gaps - likely penalty overflow"
        else:
            diagnosis = "signals_present_but_scoring_zero"
            detail = f"{len(signals_after)} signals, {len(gaps)} gaps"
    
    return {
        "case_id": case_id[:8],
        "decision_type": decision_type,
        "has_submission": has_submission,
        "evidence_count": evidence_count,
        "signals_before": len(signals_before),
        "signals_after": len(signals_after),
        "confidence": f"{intel.confidence_score}%",
        "band": intel.confidence_band,
        "completeness": f"{intel.completeness_score}%",
        "gaps": len(gaps),
        "bias": len(bias_flags),
        "passed_rules": passed_rules,
        "total_rules": total_rules,
        "critical_failures": critical_failures,
        "diagnosis": diagnosis,
        "detail": detail
    }


def main():
    """Run diagnostics on all cases."""
    
    print("=" * 150)
    print("CONFIDENCE DIAGNOSTICS - Analyzing all cases (Rule-Based Validation)")
    print("=" * 150)
    print()
    
    # Get all cases
    try:
        cases = execute_sql("SELECT id, decision_type FROM cases", {})
    except Exception as e:
        print(f"ERROR: Could not fetch cases: {e}")
        return
    
    print(f"Found {len(cases)} cases\n")
    
    # Analyze each case
    results = []
    for case_row in cases:
        case_id = case_row["id"]
        decision_type = case_row["decision_type"] or "default"
        
        result = diagnose_case(case_id, decision_type)
        results.append(result)
    
    # Print table header
    print("-" * 150)
    print(f"{'Case ID':<10} {'Type':<18} {'Sub':<4} {'Evd':<4} {'Sig':<4} {'Conf':<8} {'Band':<6} {'Rules':<10} {'Crit':<5} {'Gaps':<5} {'Diagnosis':<30}")
    print("-" * 150)
    
    # Print results
    zero_confidence_cases = []
    for r in results:
        case_id = r["case_id"]
        dt = r["decision_type"]
        has_sub = "YES" if r.get("has_submission") else "NO"
        evd = str(r.get("evidence_count", 0))
        sig = str(r.get("signals_after", 0))
        conf = r.get("confidence", "N/A")
        band = r.get("band", "")
        passed = r.get("passed_rules", 0)
        total = r.get("total_rules", 0)
        rules_str = f"{passed}/{total}" if total > 0 else "N/A"
        crit = str(r.get("critical_failures", 0))
        gaps = str(r.get("gaps", 0))
        diag = r["diagnosis"]
        
        # Highlight 0% cases (use ASCII-safe markers)
        marker = "[!]" if conf == "0.0%" or conf == "0%" else "[OK]"
        
        print(f"{marker} {case_id:<9} {dt:<18} {has_sub:<4} {evd:<4} {sig:<4} {conf:<8} {band:<6} {rules_str:<10} {crit:<5} {gaps:<5} {diag:<30}")
        
        if r.get("detail"):
            # Handle multi-line details
            detail_lines = r['detail'].split('\\n')
            for i, line in enumerate(detail_lines):
                if i == 0:
                    print(f"   └─ {line}")
                else:
                    print(f"      {line}")
        
        if conf in ("0.0%", "0%") and r.get("has_submission"):
            zero_confidence_cases.append(r)
    
    print("-" * 150)
    print()
    
    # Summary
    total = len(results)
    zero_count = len([r for r in results if r.get("confidence") in ("0.0%", "0%")])
    has_submission_zero = len([r for r in results if r.get("confidence") in ("0.0%", "0%") and r.get("has_submission")])
    
    print(f"SUMMARY:")
    print(f"  Total cases: {total}")
    print(f"  Zero confidence: {zero_count}")
    print(f"  Zero confidence WITH submission: {has_submission_zero} [WARNING]")
    print()
    
    if has_submission_zero > 0:
        print("ISSUES FOUND:")
        diagnoses = {}
        for r in zero_confidence_cases:
            diag = r["diagnosis"]
            diagnoses[diag] = diagnoses.get(diag, 0) + 1
        
        for diag, count in diagnoses.items():
            print(f"  - {diag}: {count} cases")
        print()
    
    print("=" * 150)


if __name__ == "__main__":
    main()
