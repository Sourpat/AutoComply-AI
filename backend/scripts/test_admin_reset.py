"""
Test: Admin Reset Endpoint

Tests the admin-only reset endpoints with guardrails.

⚠️ WARNING: This will DELETE ALL DATA if run with confirmation ⚠️

Usage:
    cd backend
    .venv/Scripts/python scripts/test_admin_reset.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def test_preview_endpoint():
    """Test preview endpoint (safe - doesn't delete anything)."""
    print("=== Test: GET /admin/reset/preview ===\n")
    
    try:
        from app.admin.router import preview_reset
        from unittest.mock import Mock
        
        # Mock admin request
        request = Mock()
        request.headers = {"X-AutoComply-Role": "admin"}
        
        # Call preview
        result = preview_reset(request)
        
        print("Preview result:")
        print(f"  Tables: {result.get('tables', {})}")
        print(f"  Files: {result.get('files', {})}")
        print(f"  Warning: {result.get('warning', '')}")
        print(f"  Confirmation: {result.get('confirmation_required', '')}")
        
        # Verify structure
        assert "tables" in result, "Missing 'tables' key"
        assert "files" in result, "Missing 'files' key"
        assert "warning" in result, "Missing 'warning' key"
        assert "confirmation_required" in result, "Missing 'confirmation_required' key"
        
        print("\n✓ Preview endpoint works correctly\n")
        return True
        
    except Exception as e:
        print(f"✗ Preview endpoint failed: {e}\n")
        return False


def test_reset_without_confirmation():
    """Test reset endpoint without confirmation header (should fail)."""
    print("=== Test: POST /admin/reset (no confirmation) ===\n")
    
    try:
        from app.admin.router import reset_all_data
        from fastapi import HTTPException
        from unittest.mock import Mock
        
        # Mock admin request
        request = Mock()
        request.headers = {"X-AutoComply-Role": "admin"}
        
        # Try to reset without confirmation header
        try:
            result = reset_all_data(request, x_autocomply_reset_confirm=None)
            print("✗ Should have raised HTTPException for missing confirmation\n")
            return False
        except HTTPException as e:
            print(f"✓ Correctly rejected request without confirmation:")
            print(f"  Status: {e.status_code}")
            print(f"  Detail: {e.detail}")
            print()
            return True
        
    except Exception as e:
        print(f"✗ Unexpected error: {e}\n")
        return False


def test_reset_with_wrong_confirmation():
    """Test reset endpoint with wrong confirmation value (should fail)."""
    print("=== Test: POST /admin/reset (wrong confirmation) ===\n")
    
    try:
        from app.admin.router import reset_all_data
        from fastapi import HTTPException
        from unittest.mock import Mock
        
        # Mock admin request
        request = Mock()
        request.headers = {"X-AutoComply-Role": "admin"}
        
        # Try to reset with wrong confirmation header
        try:
            result = reset_all_data(request, x_autocomply_reset_confirm="YES")
            print("✗ Should have raised HTTPException for wrong confirmation\n")
            return False
        except HTTPException as e:
            print(f"✓ Correctly rejected request with wrong confirmation:")
            print(f"  Status: {e.status_code}")
            print(f"  Detail: {e.detail}")
            print()
            return True
        
    except Exception as e:
        print(f"✗ Unexpected error: {e}\n")
        return False


def test_reset_authorization():
    """Test that non-admin users cannot access reset endpoint."""
    print("=== Test: Authorization (non-admin user) ===\n")
    
    try:
        from app.admin.router import reset_all_data
        from fastapi import HTTPException
        from unittest.mock import Mock
        
        # Mock non-admin request
        request = Mock()
        request.headers = {"X-AutoComply-Role": "verifier"}  # Not admin
        
        # Try to reset
        try:
            result = reset_all_data(request, x_autocomply_reset_confirm="RESET")
            print("✗ Should have raised HTTPException for non-admin user\n")
            return False
        except HTTPException as e:
            print(f"✓ Correctly rejected non-admin user:")
            print(f"  Status: {e.status_code}")
            print()
            return True
        
    except Exception as e:
        print(f"✗ Unexpected error: {e}\n")
        return False


def test_endpoint_structure():
    """Test that endpoints are properly structured."""
    print("=== Test: Endpoint Structure ===\n")
    
    try:
        import inspect
        from app.admin.router import router, preview_reset, reset_all_data
        
        # Check router
        print(f"Router prefix: {router.prefix}")
        print(f"Router tags: {router.tags}")
        
        assert router.prefix == "/admin", "Wrong router prefix"
        assert "admin" in router.tags, "Missing 'admin' tag"
        
        # Check preview endpoint signature
        preview_sig = inspect.signature(preview_reset)
        assert "request" in preview_sig.parameters, "preview_reset missing 'request' parameter"
        
        # Check reset endpoint signature
        reset_sig = inspect.signature(reset_all_data)
        assert "request" in reset_sig.parameters, "reset_all_data missing 'request' parameter"
        assert "x_autocomply_reset_confirm" in reset_sig.parameters, "reset_all_data missing confirmation parameter"
        
        print("\n✓ Endpoint structure is correct\n")
        return True
        
    except Exception as e:
        print(f"✗ Structure test failed: {e}\n")
        return False


def main():
    print("=" * 70)
    print("Admin Reset Endpoint - Safety Tests")
    print("=" * 70)
    print()
    print("⚠️  These tests verify safety mechanisms WITHOUT deleting data ⚠️")
    print()
    
    success = True
    
    # Test endpoint structure
    if not test_endpoint_structure():
        success = False
    
    # Test preview (safe)
    if not test_preview_endpoint():
        success = False
    
    # Test authorization
    if not test_reset_authorization():
        success = False
    
    # Test confirmation guardrails
    if not test_reset_without_confirmation():
        success = False
    
    if not test_reset_with_wrong_confirmation():
        success = False
    
    # Summary
    print("=" * 70)
    if success:
        print("✓ All safety tests passed")
        print()
        print("RESET ENDPOINT USAGE:")
        print()
        print("  1. Preview what will be deleted:")
        print("     curl http://localhost:8001/admin/reset/preview \\")
        print("       -H 'X-AutoComply-Role: admin'")
        print()
        print("  2. Actually reset (⚠️ DANGEROUS ⚠️):")
        print("     curl -X POST http://localhost:8001/admin/reset \\")
        print("       -H 'X-AutoComply-Role: admin' \\")
        print("       -H 'X-AutoComply-Reset-Confirm: RESET'")
        print()
        print("  ⚠️  The POST endpoint will DELETE ALL DATA permanently!")
    else:
        print("✗ Some tests failed")
    print("=" * 70)
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
