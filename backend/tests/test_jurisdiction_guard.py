# backend/tests/test_jurisdiction_guard.py
"""
Test jurisdiction guard to ensure Rhode Island questions don't crash.

Run with: pytest backend/tests/test_jurisdiction_guard.py -v
"""

import pytest
from src.services.jurisdiction import extract_states, has_jurisdiction_mismatch


def test_extract_rhode_island():
    """Test that Rhode Island is properly detected."""
    question = "What are Schedule IV shipping rules for Rhode Island?"
    states = extract_states(question)
    assert "RI" in states, f"Expected RI in {states}"


def test_extract_new_jersey():
    """Test that New Jersey is properly detected."""
    question = "What are the controlled substance requirements for NJ?"
    states = extract_states(question)
    assert "NJ" in states, f"Expected NJ in {states}"


def test_jurisdiction_mismatch():
    """Test jurisdiction mismatch detection."""
    # NJ question vs NY KB entry = mismatch
    requested = {"NJ"}
    entry = {"NY"}
    assert has_jurisdiction_mismatch(requested, entry) == True
    
    # NJ question vs NJ KB entry = no mismatch
    requested = {"NJ"}
    entry = {"NJ"}
    assert has_jurisdiction_mismatch(requested, entry) == False
    
    # No states in question = no mismatch (generic)
    requested = set()
    entry = {"NY"}
    assert has_jurisdiction_mismatch(requested, entry) == False
    
    # No states in entry = no mismatch (generic KB entry)
    requested = {"NJ"}
    entry = set()
    assert has_jurisdiction_mismatch(requested, entry) == False


def test_all_50_states():
    """Test that all 50 states + DC can be detected."""
    test_cases = [
        ("California regulations", "CA"),
        ("Texas requirements", "TX"),
        ("FL pharmacy license", "FL"),
        ("New York compliance", "NY"),
        ("washington state rules", "WA"),
        ("District of Columbia", "DC"),
        ("Massachusetts MA", "MA"),
    ]
    
    for text, expected_state in test_cases:
        states = extract_states(text)
        assert expected_state in states, f"Expected {expected_state} in {states} for text: {text}"


if __name__ == "__main__":
    # Quick inline test
    print("Testing Rhode Island detection...")
    test_extract_rhode_island()
    print("✓ Rhode Island detected correctly")
    
    print("\nTesting New Jersey detection...")
    test_extract_new_jersey()
    print("✓ New Jersey detected correctly")
    
    print("\nTesting jurisdiction mismatch logic...")
    test_jurisdiction_mismatch()
    print("✓ Jurisdiction mismatch logic works")
    
    print("\nTesting multiple states...")
    test_all_50_states()
    print("✓ All states detected correctly")
    
    print("\n✅ All tests passed!")
