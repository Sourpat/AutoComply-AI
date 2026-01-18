"""
Bulk recompute intelligence for all cases (Rule-Based Validation).

Iterates all cases and recomputes their decision intelligence,
showing before/after confidence scores and rule validation results.
"""

import sys
sys.path.insert(0, '.')

import json
from src.core.db import execute_sql
from app.intelligence.repository import get_decision_intelligence
from app.intelligence.service import recompute_case_intelligence


def main():
    """Recompute intelligence for all cases."""
    
    print("=" * 100)
    print("BULK INTELLIGENCE RECOMPUTE")
    print("=" * 100)
    print()
    
    # Get all cases
    try:
        cases = execute_sql("SELECT id, decision_type FROM cases", {})
    except Exception as e:
        print(f"ERROR: Could not fetch cases: {e}")
        return
    
    print(f"Found {len(cases)} cases to recompute\n")
    
    # Recompute each case
    results = []
    for i, case_row in enumerate(cases, 1):
        case_id = case_row["id"]
        decision_type = case_row["decision_type"] or "default"
        
        # Get before
        try:
            intel_before = get_decision_intelligence(case_id)
            conf_before = intel_before.confidence_score if intel_before else 0.0
        except:
            conf_before = 0.0
        
        # Recompute
        try:
            recompute_case_intelligence(case_id, decision_type)
            status = "✅"
            error = None
        except Exception as e:
            status = "❌"
            error = str(e)[:60]
        
        # Get after
        try:
            intel_after = get_decision_intelligence(case_id)
            conf_after = intel_after.confidence_score if intel_after else 0.0
            
            # Try to extract rule information
            passed_rules = 0
            total_rules = 0
            try:
                if intel_after and intel_after.executive_summary_json:
                    exec_summary = json.loads(intel_after.executive_summary_json)
                    if isinstance(exec_summary, dict):
                        passed_rules = exec_summary.get("passed_rules", 0)
                        total_rules = exec_summary.get("total_rules", 0)
            except:
                pass
        except:
            conf_after = 0.0
            passed_rules = 0
            total_rules = 0
        
        # Calculate change
        delta = conf_after - conf_before
        delta_str = f"+{delta:.1f}" if delta > 0 else f"{delta:.1f}"
        
        # Format rules
        rules_str = f"{passed_rules}/{total_rules}" if total_rules > 0 else "N/A"
        
        # Print result
        print(f"[{i}/{len(cases)}] {status} {case_id[:8]}... ({decision_type:18})")
        print(f"        Confidence: {conf_before:5.1f}% → {conf_after:5.1f}% ({delta_str}%)  Rules: {rules_str}")
        
        if error:
            print(f"        ERROR: {error}")
        
        results.append({
            "case_id": case_id,
            "decision_type": decision_type,
            "before": conf_before,
            "after": conf_after,
            "delta": delta,
            "success": status == "✅"
        })
    
    print()
    print("=" * 100)
    print("SUMMARY")
    print("=" * 100)
    
    successful = len([r for r in results if r["success"]])
    failed = len(results) - successful
    improved = len([r for r in results if r["delta"] > 0])
    still_zero = len([r for r in results if r["after"] == 0])
    
    print(f"  Total cases: {len(results)}")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Improved confidence: {improved}")
    print(f"  Still at 0%: {still_zero}")
    print()
    
    if improved > 0:
        print("Cases with improved confidence:")
        for r in results:
            if r["delta"] > 0:
                print(f"  - {r['case_id'][:8]}... {r['decision_type']:18} {r['before']:5.1f}% → {r['after']:5.1f}%")
    
    print()


if __name__ == "__main__":
    main()
