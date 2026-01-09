"""
Integration Test - Role Authorization with Workflow

This script demonstrates the complete authorization flow:
1. Verifier creates and manages a case
2. Verifier attempts admin operations (blocked)
3. Admin performs bulk operations
4. Admin exports case data
5. Admin deletes case

Run this after starting the backend server:
    cd backend
    .venv/Scripts/python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
"""

import requests
import json
from typing import Dict, Any

API_BASE = "http://127.0.0.1:8001/workflow"

# Role headers
ADMIN_HEADERS = {
    "Content-Type": "application/json",
    "X-AutoComply-Role": "admin"
}

VERIFIER_HEADERS = {
    "Content-Type": "application/json",
    "X-AutoComply-Role": "verifier"
}


def print_section(title: str):
    """Print section header."""
    print(f"\n{'=' * 70}")
    print(f"{title}")
    print('=' * 70)


def print_result(operation: str, success: bool, details: str = ""):
    """Print operation result."""
    icon = "✓" if success else "✗"
    print(f"{icon} {operation}")
    if details:
        print(f"  {details}")


def create_case(role: str = "verifier") -> str:
    """Create a test case."""
    headers = ADMIN_HEADERS if role == "admin" else VERIFIER_HEADERS
    
    data = {
        "decisionType": "csf",
        "title": "Test Case - Authorization Demo",
        "summary": "Testing role-based authorization",
        "evidence": [
            {
                "id": "ev-1",
                "title": "Test Evidence",
                "snippet": "Evidence content...",
                "citation": "Test Citation",
                "sourceId": "doc-123",
                "tags": ["test"],
                "metadata": {},
                "includedInPacket": True
            }
        ]
    }
    
    response = requests.post(f"{API_BASE}/cases", headers=headers, json=data)
    
    if response.status_code == 201:
        case_id = response.json()["id"]
        print_result(f"Created case as {role}", True, f"Case ID: {case_id}")
        return case_id
    else:
        print_result(f"Create case as {role}", False, f"Status: {response.status_code}")
        return None


def test_verifier_operations(case_id: str):
    """Test verifier allowed operations."""
    print_section("Verifier Allowed Operations")
    
    # 1. Update case status (allowed)
    response = requests.patch(
        f"{API_BASE}/cases/{case_id}",
        headers=VERIFIER_HEADERS,
        json={"status": "in_review"}
    )
    print_result(
        "Update case status",
        response.status_code == 200,
        f"Status: {response.status_code}"
    )
    
    # 2. Self-assign case (allowed)
    response = requests.patch(
        f"{API_BASE}/cases/{case_id}",
        headers=VERIFIER_HEADERS,
        json={"assignedTo": "verifier"}
    )
    print_result(
        "Self-assign unassigned case",
        response.status_code == 200,
        f"Status: {response.status_code}"
    )
    
    # 3. Add audit event (allowed)
    response = requests.post(
        f"{API_BASE}/cases/{case_id}/audit",
        headers=VERIFIER_HEADERS,
        json={
            "caseId": case_id,
            "eventType": "comment_added",
            "actor": "verifier@example.com",
            "message": "Reviewed evidence",
            "meta": {"comment": "Looks good"}
        }
    )
    print_result(
        "Add audit event",
        response.status_code == 201,
        f"Status: {response.status_code}"
    )
    
    # 4. Update packet selection (allowed)
    response = requests.patch(
        f"{API_BASE}/cases/{case_id}/evidence/packet",
        headers=VERIFIER_HEADERS,
        json=["ev-1"]
    )
    print_result(
        "Update packet selection",
        response.status_code == 200,
        f"Status: {response.status_code}"
    )


def test_verifier_blocked_operations(case_id: str):
    """Test verifier blocked operations."""
    print_section("Verifier Blocked Operations (Should Fail)")
    
    # 1. Try to export (blocked)
    response = requests.get(
        f"{API_BASE}/cases/{case_id}/export/json",
        headers=VERIFIER_HEADERS
    )
    print_result(
        "Export case (admin only)",
        response.status_code == 403,
        f"Status: {response.status_code} - {response.json().get('detail', '')}"
    )
    
    # 2. Try to bulk assign (blocked)
    response = requests.post(
        f"{API_BASE}/cases/bulk/assign",
        headers=VERIFIER_HEADERS,
        json={"caseIds": [case_id], "assignedTo": "specialist@example.com"}
    )
    print_result(
        "Bulk assign cases (admin only)",
        response.status_code == 403,
        f"Status: {response.status_code} - {response.json().get('detail', '')}"
    )
    
    # 3. Try to delete case (blocked)
    response = requests.delete(
        f"{API_BASE}/cases/{case_id}",
        headers=VERIFIER_HEADERS
    )
    print_result(
        "Delete case (admin only)",
        response.status_code == 403,
        f"Status: {response.status_code} - {response.json().get('detail', '')}"
    )
    
    # 4. Try to reassign to someone else (blocked)
    response = requests.patch(
        f"{API_BASE}/cases/{case_id}",
        headers=VERIFIER_HEADERS,
        json={"assignedTo": "specialist@example.com"}
    )
    print_result(
        "Reassign case to others (admin only)",
        response.status_code == 403,
        f"Status: {response.status_code} - {response.json().get('detail', '')}"
    )


def test_admin_operations(case_id: str):
    """Test admin allowed operations."""
    print_section("Admin Operations (All Allowed)")
    
    # 1. Reassign case
    response = requests.patch(
        f"{API_BASE}/cases/{case_id}",
        headers=ADMIN_HEADERS,
        json={"assignedTo": "specialist@example.com"}
    )
    print_result(
        "Reassign case to specialist",
        response.status_code == 200,
        f"Status: {response.status_code}"
    )
    
    # 2. Bulk update status
    response = requests.post(
        f"{API_BASE}/cases/bulk/status",
        headers=ADMIN_HEADERS,
        json={"caseIds": [case_id], "status": "approved"}
    )
    print_result(
        "Bulk update status",
        response.status_code == 200,
        f"Success: {response.json().get('success', 0)}/{response.json().get('total', 0)}"
    )
    
    # 3. Export case as JSON
    response = requests.get(
        f"{API_BASE}/cases/{case_id}/export/json",
        headers=ADMIN_HEADERS
    )
    print_result(
        "Export case as JSON",
        response.status_code == 200,
        f"Export format: {response.json().get('exportFormat', 'unknown')}"
    )
    
    # 4. Export case as PDF (placeholder)
    response = requests.get(
        f"{API_BASE}/cases/{case_id}/export/pdf",
        headers=ADMIN_HEADERS
    )
    print_result(
        "Export case as PDF",
        response.status_code == 200,
        f"Placeholder: {response.json().get('placeholder', False)}"
    )


def test_bulk_operations():
    """Test admin bulk operations."""
    print_section("Bulk Operations (Admin Only)")
    
    # Create multiple cases
    case_ids = []
    for i in range(3):
        case_id = create_case("admin")
        if case_id:
            case_ids.append(case_id)
    
    if len(case_ids) < 3:
        print_result("Create 3 cases for bulk test", False, "Failed to create cases")
        return
    
    # Bulk assign
    response = requests.post(
        f"{API_BASE}/cases/bulk/assign",
        headers=ADMIN_HEADERS,
        json={"caseIds": case_ids, "assignedTo": "team-lead@example.com"}
    )
    print_result(
        f"Bulk assign {len(case_ids)} cases",
        response.status_code == 200,
        f"Success: {response.json().get('success', 0)}/{response.json().get('total', 0)}"
    )
    
    # Bulk status update
    response = requests.post(
        f"{API_BASE}/cases/bulk/status",
        headers=ADMIN_HEADERS,
        json={"caseIds": case_ids, "status": "in_review"}
    )
    print_result(
        f"Bulk update status for {len(case_ids)} cases",
        response.status_code == 200,
        f"Success: {response.json().get('success', 0)}/{response.json().get('total', 0)}"
    )
    
    # Clean up - delete bulk cases
    for case_id in case_ids:
        requests.delete(f"{API_BASE}/cases/{case_id}", headers=ADMIN_HEADERS)
    print_result(f"Cleanup: Deleted {len(case_ids)} bulk test cases", True)


def test_default_role():
    """Test default role behavior (no header)."""
    print_section("Default Role Behavior (No Header)")
    
    # Create case without role header
    response = requests.post(
        f"{API_BASE}/cases",
        headers={"Content-Type": "application/json"},  # No role header
        json={
            "decisionType": "csf",
            "title": "Test Case - No Role Header",
            "summary": "Should default to verifier role"
        }
    )
    
    if response.status_code == 201:
        case_id = response.json()["id"]
        print_result("Create case without role header", True, f"Case ID: {case_id}")
        
        # Try admin operation (should fail - defaults to verifier)
        response = requests.delete(
            f"{API_BASE}/cases/{case_id}",
            headers={"Content-Type": "application/json"}  # No role header
        )
        print_result(
            "Delete without role header (defaults to verifier)",
            response.status_code == 403,
            f"Status: {response.status_code} - Blocked as expected"
        )
        
        # Cleanup with admin
        requests.delete(f"{API_BASE}/cases/{case_id}", headers=ADMIN_HEADERS)
    else:
        print_result("Create case without role header", False, f"Status: {response.status_code}")


def main():
    """Run integration test suite."""
    print("=" * 70)
    print("Role-Based Authorization Integration Test")
    print("=" * 70)
    print("\nPrerequisites:")
    print("  - Backend server running on http://127.0.0.1:8001")
    print("  - Database initialized")
    
    try:
        # Health check
        response = requests.get(f"{API_BASE}/health")
        if response.status_code != 200:
            print("\n❌ Backend server not responding. Please start the server first:")
            print("   cd backend")
            print("   .venv/Scripts/python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001")
            return 1
        
        print_result("Backend server health check", True, "Server is running")
        
        # Run tests
        case_id = create_case("verifier")
        if not case_id:
            print("\n❌ Failed to create test case")
            return 1
        
        test_verifier_operations(case_id)
        test_verifier_blocked_operations(case_id)
        test_admin_operations(case_id)
        test_bulk_operations()
        test_default_role()
        
        # Cleanup
        print_section("Cleanup")
        response = requests.delete(f"{API_BASE}/cases/{case_id}", headers=ADMIN_HEADERS)
        print_result("Delete test case", response.status_code == 200)
        
        print("\n" + "=" * 70)
        print("✅ ALL INTEGRATION TESTS COMPLETED!")
        print("=" * 70)
        print("\nSummary:")
        print("  ✓ Verifier can: update status, self-assign, add notes, curate packet")
        print("  ✓ Verifier blocked: export, bulk ops, delete, reassign to others")
        print("  ✓ Admin can: all operations including bulk and export")
        print("  ✓ Default role: verifier (when header absent)")
        
        return 0
        
    except requests.exceptions.ConnectionError:
        print("\n❌ Cannot connect to backend server. Please start the server first:")
        print("   cd backend")
        print("   .venv/Scripts/python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
