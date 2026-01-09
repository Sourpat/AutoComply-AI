"""
Test: Case Search Quality Improvements

Validates normalized search functionality across case and submission fields.

Usage:
    cd backend
    .venv/Scripts/python scripts/test_search_quality.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.workflow.repo import normalize_search_text, build_searchable_text


def test_normalize_search_text():
    """Test text normalization."""
    print("=== Test: normalize_search_text() ===\n")
    
    tests = [
        ("  John   DOE  ", "john doe"),
        ("CSF_Practitioner", "csf_practitioner"),
        ("Multiple   Spaces    Here", "multiple spaces here"),
        ("", ""),
        (None, ""),
        ("UPPERCASE", "uppercase"),
        ("lowercase", "lowercase"),
        ("MiXeD CaSe", "mixed case"),
    ]
    
    passed = 0
    for input_text, expected in tests:
        result = normalize_search_text(input_text)
        status = "✓" if result == expected else "✗"
        print(f"{status} Input: {repr(input_text):30} → {repr(result):20} (expected: {repr(expected)})")
        if result == expected:
            passed += 1
    
    print(f"\nPassed: {passed}/{len(tests)}\n")
    return passed == len(tests)


def test_build_searchable_text():
    """Test searchable text builder."""
    print("=== Test: build_searchable_text() ===\n")
    
    # Test 1: Basic case fields only
    result = build_searchable_text(
        title="CSF Practitioner Review",
        summary="Application for verification",
        decision_type="csf_practitioner",
        assigned_to="verifier@example.com",
        submission_fields=None
    )
    print("Test 1: Basic fields (no submission)")
    print(f"  Result: {result}")
    assert "csf practitioner review" in result
    assert "application for verification" in result
    assert "csf practitioner" in result  # decision_type with underscore → space
    assert "verifier@example.com" in result
    print("  ✓ All fields present\n")
    
    # Test 2: With submission fields
    result = build_searchable_text(
        title="Verification Required",
        summary=None,
        decision_type="csf_practitioner",
        assigned_to=None,
        submission_fields={
            "practitionerName": "Dr. Jane Smith",
            "npi": "9876543210",
            "dea": "AS1234567",
            "ignored_field": "Should not appear"
        }
    )
    print("Test 2: With submission fields")
    print(f"  Result: {result}")
    assert "verification required" in result
    assert "dr. jane smith" in result
    assert "9876543210" in result
    assert "as1234567" in result
    assert "ignored_field" not in result  # Only whitelisted keys
    print("  ✓ Submission fields included\n")
    
    # Test 3: Facility submission
    result = build_searchable_text(
        title="Facility Review",
        summary="Hospital application",
        decision_type="csf_facility",
        assigned_to="admin@example.com",
        submission_fields={
            "facilityName": "General Hospital",
            "organizationName": "Healthcare Corp",
            "ein": "12-3456789"
        }
    )
    print("Test 3: Facility fields")
    print(f"  Result: {result}")
    assert "general hospital" in result
    assert "healthcare corp" in result
    assert "12-3456789" in result
    print("  ✓ Facility fields included\n")
    
    # Test 4: Normalization applied
    result = build_searchable_text(
        title="  UPPERCASE  TITLE  ",
        summary="Multiple   Spaces",
        decision_type="ohio_tddd",
        assigned_to="  User@Example.COM  ",
        submission_fields=None
    )
    print("Test 4: Normalization")
    print(f"  Result: {result}")
    assert "uppercase title" in result  # Normalized
    assert "multiple spaces" in result  # Normalized
    assert "ohio tddd" in result  # Underscore → space
    assert "user@example.com" in result  # Normalized
    assert "  " not in result  # No multiple spaces
    print("  ✓ Normalization applied\n")
    
    print("All tests passed ✓\n")
    return True


def main():
    print("=" * 60)
    print("Case Search Quality - Unit Tests")
    print("=" * 60)
    print()
    
    success = True
    
    # Run tests
    if not test_normalize_search_text():
        success = False
    
    if not test_build_searchable_text():
        success = False
    
    # Summary
    print("=" * 60)
    if success:
        print("✓ All tests passed")
    else:
        print("✗ Some tests failed")
    print("=" * 60)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
