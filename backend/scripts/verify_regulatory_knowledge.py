"""
Quick verification script for regulatory knowledge datasets.
Run this to verify all datasets are loaded correctly.
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from src.autocomply.regulations.knowledge import get_regulatory_knowledge

def main():
    print("=" * 70)
    print("REGULATORY KNOWLEDGE VERIFICATION")
    print("=" * 70)
    
    kb = get_regulatory_knowledge()
    
    # Total sources
    print(f"\n📊 Total sources in knowledge base: {len(kb._sources_by_id)}")
    
    # Test each decision type
    decision_types = [
        ("csf", "csf_practitioner", 19, "CSF Practitioner"),
        ("license", "ohio_tddd", 19, "Ohio TDDD"),
        ("license", "ny_pharmacy_license", 27, "NY Pharmacy License"),
        ("csf", "csf_facility", 28, "CSF Facility"),
    ]
    
    print("\n📋 Decision Type Coverage:")
    print("-" * 70)
    
    all_passed = True
    for engine, decision_type, expected, name in decision_types:
        sources = kb.get_context_for_engine(engine_family=engine, decision_type=decision_type)
        actual = len(sources)
        status = "✅" if actual == expected else "❌"
        
        if actual != expected:
            all_passed = False
        
        print(f"{status} {name:25} ({engine}:{decision_type})")
        print(f"   Expected: {expected} sources, Got: {actual} sources")
        
        # Show sample rule IDs
        rule_ids = [s.id for s in sources if decision_type in s.id and any(s.id.endswith(f'_00{i}') or s.id.endswith(f'_0{i}') for i in range(1, 4))][:3]
        if rule_ids:
            print(f"   Sample rules: {', '.join(rule_ids)}")
    
    print("-" * 70)
    
    # Search test
    print("\n🔍 Testing search functionality:")
    search_results = kb.search_sources("controlled substance security", limit=3)
    print(f"   Query: 'controlled substance security'")
    print(f"   Results: {len(search_results)} sources found")
    for src in search_results[:3]:
        print(f"     - {src.id} (score: {src.score})")
    
    print("\n" + "=" * 70)
    if all_passed:
        print("✅ ALL CHECKS PASSED - Regulatory knowledge loaded correctly!")
    else:
        print("❌ SOME CHECKS FAILED - Review output above")
    print("=" * 70)

if __name__ == "__main__":
    main()
