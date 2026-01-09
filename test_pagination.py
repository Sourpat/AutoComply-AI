"""
Quick test script for pagination endpoints

Run this to verify pagination is working correctly.
"""

import sys
sys.path.insert(0, 'backend')

from app.workflow.repo import list_cases, list_audit_events
from app.workflow.models import CaseListFilters, CaseStatus

def test_pagination():
    print("Testing pagination implementation...\n")
    
    # Test 1: list_cases with pagination
    print("Test 1: list_cases pagination")
    try:
        cases, total = list_cases(limit=10, offset=0)
        print(f"✓ Got {len(cases)} cases, total: {total}")
        assert isinstance(cases, list), "cases should be a list"
        assert isinstance(total, int), "total should be an int"
        
        # Test with filters
        cases2, total2 = list_cases(
            filters=CaseListFilters(status=CaseStatus.NEW),
            limit=5,
            offset=0,
            sort_by="createdAt",
            sort_dir="desc"
        )
        print(f"✓ Filtered query: {len(cases2)} cases, total: {total2}")
    except Exception as e:
        print(f"✗ Error in list_cases: {e}")
        return False
    
    # Test 2: list_audit_events with pagination
    print("\nTest 2: list_audit_events pagination")
    try:
        # Need a case ID - use first case if available
        if cases:
            case_id = cases[0].id
            events, total = list_audit_events(case_id, limit=20, offset=0)
            print(f"✓ Got {len(events)} audit events, total: {total}")
            assert isinstance(events, list), "events should be a list"
            assert isinstance(total, int), "total should be an int"
        else:
            print("⚠ No cases to test audit events pagination")
    except Exception as e:
        print(f"✗ Error in list_audit_events: {e}")
        return False
    
    # Test 3: Pagination consistency
    print("\nTest 3: Pagination consistency")
    try:
        # Get first page
        page1, total = list_cases(limit=5, offset=0)
        # Get second page
        page2, total2 = list_cases(limit=5, offset=5)
        
        assert total == total2, "Total should be same across pages"
        
        # Verify no duplicates
        page1_ids = [c.id for c in page1]
        page2_ids = [c.id for c in page2]
        duplicates = set(page1_ids) & set(page2_ids)
        assert len(duplicates) == 0, f"Pages should not overlap: {duplicates}"
        
        print(f"✓ No duplicates between pages")
        print(f"✓ Total consistent: {total}")
    except Exception as e:
        print(f"✗ Error in pagination consistency: {e}")
        return False
    
    print("\n✅ All pagination tests passed!")
    return True

if __name__ == "__main__":
    success = test_pagination()
    sys.exit(0 if success else 1)
