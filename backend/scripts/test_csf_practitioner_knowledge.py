"""
Quick validation test for CSF Practitioner knowledge integration.

Run this to verify:
1. Rules load without errors
2. Preview returns CSF practitioner items
3. Search finds CSF practitioner rules
"""

import sys
from pathlib import Path

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(backend_src))

from autocomply.regulations.csf_practitioner_seed import (
    get_csf_practitioner_rules,
    get_csf_practitioner_summary,
)
from autocomply.regulations.knowledge import get_regulatory_knowledge


def test_rule_loading():
    """Test that rules load correctly."""
    print("\n=== Test 1: Rule Loading ===")
    
    rules = get_csf_practitioner_rules()
    summary = get_csf_practitioner_summary()
    
    print(f"✅ Loaded {summary['total_rules']} rules")
    print(f"   - Block: {summary['block_rules']}")
    print(f"   - Review: {summary['review_rules']}")
    print(f"   - Info: {summary['info_rules']}")
    print(f"   - Jurisdictions: {', '.join(summary['jurisdictions'])}")
    
    assert summary['total_rules'] == 12, f"Expected 12 rules, got {summary['total_rules']}"
    assert summary['block_rules'] == 3, f"Expected 3 block rules, got {summary['block_rules']}"
    assert summary['review_rules'] == 4, f"Expected 4 review rules, got {summary['review_rules']}"
    assert summary['info_rules'] == 5, f"Expected 5 info rules, got {summary['info_rules']}"
    
    print("✅ All assertions passed")


def test_knowledge_integration():
    """Test that knowledge service includes CSF practitioner rules."""
    print("\n=== Test 2: Knowledge Integration ===")
    
    knowledge = get_regulatory_knowledge()
    
    # Test get_context_for_engine
    sources = knowledge.get_context_for_engine(
        engine_family="csf",
        decision_type="csf_practitioner"
    )
    
    print(f"✅ get_context_for_engine returned {len(sources)} sources")
    
    # Should have original form + 12 new rules = 13 total
    assert len(sources) >= 12, f"Expected at least 12 sources, got {len(sources)}"
    
    # Verify specific rule IDs are present
    source_ids = {src.id for src in sources}
    required_ids = [
        "csf_pract_dea_001",
        "csf_pract_state_002",
        "csf_pract_schedule_003",
    ]
    
    for rid in required_ids:
        assert rid in source_ids, f"Missing required ID: {rid}"
        print(f"   ✓ Found rule: {rid}")
    
    print("✅ All required rules present")


def test_search():
    """Test that search finds CSF practitioner rules."""
    print("\n=== Test 3: Search Functionality ===")
    
    knowledge = get_regulatory_knowledge()
    
    # Search for practitioner-related terms
    results = knowledge.search_sources("DEA practitioner registration", limit=5)
    
    print(f"✅ Search returned {len(results)} results")
    
    if results:
        top = results[0]
        print(f"   Top result: {top.label}")
        print(f"   Jurisdiction: {top.jurisdiction}")
        print(f"   Citation: {top.citation}")
        print(f"   Score: {top.score:.4f}")
    
    assert len(results) > 0, "Search should return at least one result"
    print("✅ Search working correctly")


def test_preview_by_doc_ids():
    """Test preview by specific doc IDs."""
    print("\n=== Test 4: Preview by Doc IDs ===")
    
    knowledge = get_regulatory_knowledge()
    
    doc_ids = [
        "csf_pract_dea_001",
        "csf_pract_attestation_006",
    ]
    
    sources = knowledge.get_sources_for_doc_ids(doc_ids)
    
    print(f"✅ Preview returned {len(sources)} sources for {len(doc_ids)} doc IDs")
    
    assert len(sources) == len(doc_ids), f"Expected {len(doc_ids)} sources, got {len(sources)}"
    
    for src in sources:
        print(f"   - {src.id}: {src.label}")
    
    print("✅ Doc ID lookup working correctly")


if __name__ == "__main__":
    print("=" * 60)
    print("CSF Practitioner Knowledge Validation")
    print("=" * 60)
    
    try:
        test_rule_loading()
        test_knowledge_integration()
        test_search()
        test_preview_by_doc_ids()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
