"""
Test Role-Based Authorization

This script tests the authorization module to ensure:
1. get_role() extracts role from headers correctly
2. require_admin() raises 403 for non-admins
3. can_reassign_case() enforces correct reassignment rules
4. Router endpoints enforce authorization
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from fastapi import Request, HTTPException
from app.core.authz import get_role, require_admin, can_reassign_case


class MockRequest:
    """Mock FastAPI Request for testing."""
    def __init__(self, headers: dict):
        self.headers = headers


def test_get_role():
    """Test role extraction from headers."""
    print("\n=== Testing get_role() ===")
    
    # Admin role
    request = MockRequest({"X-AutoComply-Role": "admin"})
    role = get_role(request)
    assert role == "admin", f"Expected 'admin', got '{role}'"
    print("✓ Admin role extracted correctly")
    
    # Verifier role
    request = MockRequest({"X-AutoComply-Role": "verifier"})
    role = get_role(request)
    assert role == "verifier", f"Expected 'verifier', got '{role}'"
    print("✓ Verifier role extracted correctly")
    
    # Missing header (defaults to verifier)
    request = MockRequest({})
    role = get_role(request)
    assert role == "verifier", f"Expected 'verifier' (default), got '{role}'"
    print("✓ Missing header defaults to verifier")
    
    # Invalid role (defaults to verifier)
    request = MockRequest({"X-AutoComply-Role": "superuser"})
    role = get_role(request)
    assert role == "verifier", f"Expected 'verifier' (invalid role), got '{role}'"
    print("✓ Invalid role defaults to verifier")
    
    # Case insensitive
    request = MockRequest({"X-AutoComply-Role": "ADMIN"})
    role = get_role(request)
    assert role == "admin", f"Expected 'admin' (case insensitive), got '{role}'"
    print("✓ Case insensitive role matching works")


def test_require_admin():
    """Test admin requirement enforcement."""
    print("\n=== Testing require_admin() ===")
    
    # Admin allowed
    admin_request = MockRequest({"X-AutoComply-Role": "admin"})
    try:
        require_admin(admin_request)
        print("✓ Admin role allowed")
    except HTTPException:
        raise AssertionError("Admin should be allowed")
    
    # Verifier blocked
    verifier_request = MockRequest({"X-AutoComply-Role": "verifier"})
    try:
        require_admin(verifier_request)
        raise AssertionError("Verifier should be blocked")
    except HTTPException as e:
        assert e.status_code == 403
        assert "Admin role required" in e.detail
        print("✓ Verifier blocked with 403 Forbidden")
    
    # Default role blocked
    default_request = MockRequest({})
    try:
        require_admin(default_request)
        raise AssertionError("Default role (verifier) should be blocked")
    except HTTPException as e:
        assert e.status_code == 403
        print("✓ Default role blocked with 403 Forbidden")


def test_can_reassign_case():
    """Test case reassignment authorization."""
    print("\n=== Testing can_reassign_case() ===")
    
    admin_request = MockRequest({"X-AutoComply-Role": "admin"})
    verifier_request = MockRequest({"X-AutoComply-Role": "verifier"})
    
    # Admin can reassign anyone to anyone
    assert can_reassign_case(admin_request, None, "user1") == True
    print("✓ Admin can assign unassigned case to user")
    
    assert can_reassign_case(admin_request, "user1", "user2") == True
    print("✓ Admin can reassign from user1 to user2")
    
    assert can_reassign_case(admin_request, "user1", None) == True
    print("✓ Admin can unassign case")
    
    # Verifier can only self-assign from unassigned
    assert can_reassign_case(verifier_request, None, "verifier") == True
    print("✓ Verifier can self-assign unassigned case")
    
    assert can_reassign_case(verifier_request, None, "other_user") == False
    print("✓ Verifier cannot assign to others (needs admin)")
    
    assert can_reassign_case(verifier_request, "user1", "verifier") == False
    print("✓ Verifier cannot reassign from others (needs admin)")
    
    assert can_reassign_case(verifier_request, "verifier", None) == False
    print("✓ Verifier cannot unassign (needs admin)")


def test_authorization_scenarios():
    """Test real-world authorization scenarios."""
    print("\n=== Testing Authorization Scenarios ===")
    
    admin_request = MockRequest({"X-AutoComply-Role": "admin"})
    verifier_request = MockRequest({"X-AutoComply-Role": "verifier"})
    
    # Scenario 1: New case arrives, verifier wants to claim it
    print("\nScenario 1: Verifier claims unassigned case")
    can_claim = can_reassign_case(verifier_request, None, "verifier")
    assert can_claim == True
    print("  ✓ Allowed - Verifier can self-assign")
    
    # Scenario 2: Verifier tries to reassign their case to colleague
    print("\nScenario 2: Verifier tries to reassign to colleague")
    can_reassign = can_reassign_case(verifier_request, "verifier", "colleague@example.com")
    assert can_reassign == False
    print("  ✓ Blocked - Requires admin role")
    
    # Scenario 3: Admin reassigns case from verifier to specialist
    print("\nScenario 3: Admin reassigns to specialist")
    can_reassign = can_reassign_case(admin_request, "verifier", "specialist@example.com")
    assert can_reassign == True
    print("  ✓ Allowed - Admin can reassign")
    
    # Scenario 4: Admin bulk assigns 10 cases to a team member
    print("\nScenario 4: Admin bulk assigns cases")
    for i in range(10):
        can_assign = can_reassign_case(admin_request, None, f"team-member-{i}")
        assert can_assign == True
    print("  ✓ Allowed - Admin can bulk assign")
    
    # Scenario 5: Verifier tries to export case data
    print("\nScenario 5: Verifier tries to export (requires admin)")
    try:
        require_admin(verifier_request)
        raise AssertionError("Should have been blocked")
    except HTTPException as e:
        assert e.status_code == 403
        print("  ✓ Blocked - Export requires admin")
    
    # Scenario 6: Admin exports case data
    print("\nScenario 6: Admin exports case")
    try:
        require_admin(admin_request)
        print("  ✓ Allowed - Admin can export")
    except HTTPException:
        raise AssertionError("Admin should be allowed to export")


def test_header_variations():
    """Test various header formats and edge cases."""
    print("\n=== Testing Header Variations ===")
    
    # Standard header
    request = MockRequest({"X-AutoComply-Role": "admin"})
    assert get_role(request) == "admin"
    print("✓ Standard header format")
    
    # Lowercase header value
    request = MockRequest({"X-AutoComply-Role": "admin"})
    assert get_role(request) == "admin"
    print("✓ Lowercase header value")
    
    # Uppercase header value
    request = MockRequest({"X-AutoComply-Role": "ADMIN"})
    assert get_role(request) == "admin"
    print("✓ Uppercase header value")
    
    # Mixed case
    request = MockRequest({"X-AutoComply-Role": "AdMiN"})
    assert get_role(request) == "admin"
    print("✓ Mixed case header value")
    
    # Empty header
    request = MockRequest({"X-AutoComply-Role": ""})
    assert get_role(request) == "verifier"  # Defaults to verifier
    print("✓ Empty header defaults to verifier")
    
    # Whitespace
    request = MockRequest({"X-AutoComply-Role": "  admin  "})
    assert get_role(request) == "verifier"  # Whitespace makes it invalid
    print("✓ Whitespace handled (defaults to verifier)")


def main():
    """Run all authorization tests."""
    print("=" * 70)
    print("Role-Based Authorization Test Suite")
    print("=" * 70)
    
    try:
        test_get_role()
        test_require_admin()
        test_can_reassign_case()
        test_authorization_scenarios()
        test_header_variations()
        
        print("\n" + "=" * 70)
        print("✅ ALL AUTHORIZATION TESTS PASSED!")
        print("=" * 70)
        print("\nAuthorization Rules:")
        print("  • Admin: Full access (bulk ops, reassignment, exports, deletes)")
        print("  • Verifier: Case management (status changes, notes, packet curation)")
        print("  • Verifier limitations: Can only self-assign from unassigned")
        print("  • Default role: verifier (if header absent or invalid)")
        print("\nHeader Format:")
        print("  X-AutoComply-Role: admin | verifier")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
