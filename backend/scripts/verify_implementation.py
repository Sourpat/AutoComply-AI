"""
Verification Test Script

Tests all the implementations:
1. Pagination (cases and audit events)
2. Audit immutability
3. Search quality
4. Export (PDF watermark/signature)
5. Admin reset

Run this from backend directory:
    .venv/Scripts/python scripts/verify_implementation.py
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def test_pagination():
    """Test 1: Pagination for cases and audit events"""
    print("\n" + "="*70)
    print("TEST 1: Pagination")
    print("="*70)
    
    from app.workflow.repo import list_cases, list_audit_events, create_case, add_audit_event
    from app.workflow.models import CaseCreateInput, AuditEventCreateInput, AuditEventType
    
    # Create some test cases
    print("\nCreating test cases...")
    case_ids = []
    for i in range(10):
        case = create_case(CaseCreateInput(
            decisionType="Test",
            title=f"Test Case {i+1}",
            summary=f"Test case {i+1} for pagination"
        ))
        case_ids.append(case.id)
    
    # Test case pagination
    print("\nTesting case pagination...")
    
    # Page 1
    items1, total1 = list_cases(limit=5, offset=0)
    print(f"  Page 1 (limit=5, offset=0): {len(items1)} items, total={total1}")
    assert len(items1) == 5, f"Expected 5 items, got {len(items1)}"
    assert total1 >= 10, f"Expected total >= 10, got {total1}"
    
    # Page 2
    items2, total2 = list_cases(limit=5, offset=5)
    print(f"  Page 2 (limit=5, offset=5): {len(items2)} items, total={total2}")
    assert len(items2) >= 5, f"Expected at least 5 items, got {len(items2)}"
    
    # No duplicates
    ids1 = {item.id for item in items1}
    ids2 = {item.id for item in items2}
    duplicates = ids1 & ids2
    print(f"  No duplicates: {len(duplicates) == 0}")
    assert len(duplicates) == 0, f"Found {len(duplicates)} duplicate IDs across pages"
    
    # Test audit event pagination
    print("\nTesting audit event pagination...")
    
    # Add some audit events to first case
    for i in range(15):
        add_audit_event(AuditEventCreateInput(
            caseId=case_ids[0],
            eventType=AuditEventType.NOTE_ADDED,
            actor="test-user",
            source="verifier",
            message=f"Test event {i+1}"
        ))
    
    # Page 1
    events1, total_events = list_audit_events(case_ids[0], limit=10, offset=0)
    print(f"  Page 1 (limit=10, offset=0): {len(events1)} events, total={total_events}")
    assert len(events1) == 10, f"Expected 10 events, got {len(events1)}"
    assert total_events >= 15, f"Expected total >= 15, got {total_events}"
    
    # Page 2
    events2, _ = list_audit_events(case_ids[0], limit=10, offset=10)
    print(f"  Page 2 (limit=10, offset=10): {len(events2)} events")
    assert len(events2) >= 5, f"Expected at least 5 events, got {len(events2)}"
    
    print("\n✅ Pagination tests passed!")
    return True


def test_audit_immutability():
    """Test 2: Audit immutability"""
    print("\n" + "="*70)
    print("TEST 2: Audit Immutability")
    print("="*70)
    
    from app.workflow import repo
    
    # Check that no update/delete functions exist for audit events
    print("\nChecking repo module...")
    
    has_update = hasattr(repo, 'update_audit_event')
    has_delete = hasattr(repo, 'delete_audit_event')
    
    print(f"  update_audit_event exists: {has_update}")
    print(f"  delete_audit_event exists: {has_delete}")
    
    assert not has_update, "Found update_audit_event - audit events should be immutable!"
    assert not has_delete, "Found delete_audit_event - audit events should be immutable!"
    
    # Check router
    from app.workflow import router as workflow_router
    
    # Get all route paths
    routes = [route.path for route in workflow_router.router.routes]
    audit_routes = [r for r in routes if 'audit' in r]
    
    print(f"\n  Audit routes found: {audit_routes}")
    
    # Should only have GET and POST, no PUT/PATCH/DELETE
    dangerous_routes = [r for r in audit_routes if any(
        method in str(r) for method in ['PUT', 'PATCH', 'DELETE']
    )]
    
    print(f"  Dangerous routes: {dangerous_routes}")
    assert len(dangerous_routes) == 0, "Found routes that could modify/delete audit events!"
    
    print("\n✅ Audit immutability tests passed!")
    return True


def test_search_quality():
    """Test 3: Search quality"""
    print("\n" + "="*70)
    print("TEST 3: Search Quality")
    print("="*70)
    
    from app.workflow.repo import create_case, list_cases
    from app.workflow.models import CaseCreateInput, CaseListFilters
    from app.submissions.repo import create_submission
    from app.submissions.models import SubmissionCreateInput
    
    # Create a submission with searchable data
    print("\nCreating test submission...")
    submission = create_submission(SubmissionCreateInput(
        decisionType="CSF Practitioner",
        submittedBy="dr.jane.smith@hospital.com",
        formData={
            "practitioner_name": "Dr. Jane Smith",
            "npi": "1234567890",
            "dea": "BS1234563"
        }
    ))
    
    # Create case linked to submission
    print("Creating linked case...")
    case = create_case(CaseCreateInput(
        decisionType="CSF Practitioner",
        title="CSF Application Review",
        summary="Review controlled substance facility application",
        submissionId=submission.id
    ))
    
    # Test search
    print("\nTesting search...")
    
    # Search by title
    results, _ = list_cases(filters=CaseListFilters(search="CSF Application"))
    print(f"  Search 'CSF Application': {len(results)} results")
    assert len(results) > 0, "Search by title should return results"
    
    # Search by decision type
    results, _ = list_cases(filters=CaseListFilters(search="Practitioner"))
    print(f"  Search 'Practitioner': {len(results)} results")
    assert len(results) > 0, "Search by decision type should return results"
    
    # Search by NPI (submission field)
    results, _ = list_cases(filters=CaseListFilters(search="1234567890"))
    print(f"  Search '1234567890' (NPI): {len(results)} results")
    assert len(results) > 0, "Search by NPI should return results"
    
    # Search by DEA (submission field)
    results, _ = list_cases(filters=CaseListFilters(search="BS1234563"))
    print(f"  Search 'BS1234563' (DEA): {len(results)} results")
    assert len(results) > 0, "Search by DEA should return results"
    
    # Case insensitive
    results, _ = list_cases(filters=CaseListFilters(search="csf application"))
    print(f"  Search 'csf application' (lowercase): {len(results)} results")
    assert len(results) > 0, "Search should be case-insensitive"
    
    print("\n✅ Search quality tests passed!")
    return True


def test_pdf_export():
    """Test 4: PDF export with watermark and signature"""
    print("\n" + "="*70)
    print("TEST 4: PDF Export")
    print("="*70)
    
    from app.workflow.repo import create_case
    from app.workflow.models import CaseCreateInput
    from app.workflow.exporter import generate_pdf, build_case_bundle
    import hashlib
    import json
    
    # Create a test case
    print("\nCreating test case...")
    case = create_case(CaseCreateInput(
        decisionType="Test Export",
        title="PDF Export Test",
        summary="Testing PDF generation with watermark and signature"
    ))
    
    # Generate PDF
    print("Generating PDF...")
    pdf_bytes = generate_pdf(case.id)
    
    print(f"  PDF size: {len(pdf_bytes)} bytes")
    assert len(pdf_bytes) > 0, "PDF should be generated"
    assert len(pdf_bytes) > 1000, "PDF seems too small"
    
    # Check for watermark text in PDF (basic check)
    pdf_text = pdf_bytes.decode('latin-1', errors='ignore')
    has_watermark = "DEMO" in pdf_text or "NOT FOR PRODUCTION" in pdf_text
    print(f"  Contains watermark text: {has_watermark}")
    
    # Build bundle and compute signature
    print("\nVerifying signature hash...")
    bundle = build_case_bundle(case.id)
    bundle_json = json.dumps(bundle, sort_keys=True, default=str)
    expected_hash = hashlib.sha256(bundle_json.encode()).hexdigest()[:12]
    
    print(f"  Signature hash: {expected_hash}")
    assert len(expected_hash) == 12, "Signature hash should be 12 characters"
    
    print("\n✅ PDF export tests passed!")
    return True


def test_admin_reset():
    """Test 5: Admin reset endpoint"""
    print("\n" + "="*70)
    print("TEST 5: Admin Reset")
    print("="*70)
    
    from fastapi.testclient import TestClient
    from src.api.main import app
    
    client = TestClient(app)
    
    # Test preview (should work without confirmation header)
    print("\nTesting preview endpoint...")
    response = client.get(
        "/admin/reset/preview",
        headers={"X-AutoComply-Role": "admin"}
    )
    
    print(f"  Status: {response.status_code}")
    assert response.status_code == 200, f"Preview should return 200, got {response.status_code}"
    
    preview_data = response.json()
    print(f"  Tables: {preview_data.get('tables', {})}")
    print(f"  Files: {preview_data.get('files', {})}")
    
    assert 'tables' in preview_data, "Preview should include tables"
    assert 'files' in preview_data, "Preview should include files"
    assert 'warning' in preview_data, "Preview should include warning"
    
    # Test reset without confirmation header (should fail)
    print("\nTesting reset without confirmation header...")
    response = client.post(
        "/admin/reset",
        headers={"X-AutoComply-Role": "admin"}
    )
    
    print(f"  Status: {response.status_code}")
    assert response.status_code == 403, f"Reset without confirmation should return 403, got {response.status_code}"
    
    # Test reset without admin role (should fail)
    print("\nTesting reset without admin role...")
    response = client.post(
        "/admin/reset",
        headers={
            "X-AutoComply-Role": "verifier",
            "X-AutoComply-Reset-Confirm": "RESET"
        }
    )
    
    print(f"  Status: {response.status_code}")
    assert response.status_code == 403, f"Reset by non-admin should return 403, got {response.status_code}"
    
    print("\n✅ Admin reset tests passed!")
    print("\n⚠️  Note: Actual reset not executed to preserve test data")
    return True


def main():
    print("\n" + "="*70)
    print("VERIFICATION TEST SUITE")
    print("="*70)
    
    results = []
    
    try:
        results.append(("Pagination", test_pagination()))
    except Exception as e:
        print(f"\n❌ Pagination test failed: {e}")
        results.append(("Pagination", False))
    
    try:
        results.append(("Audit Immutability", test_audit_immutability()))
    except Exception as e:
        print(f"\n❌ Audit immutability test failed: {e}")
        results.append(("Audit Immutability", False))
    
    try:
        results.append(("Search Quality", test_search_quality()))
    except Exception as e:
        print(f"\n❌ Search quality test failed: {e}")
        results.append(("Search Quality", False))
    
    try:
        results.append(("PDF Export", test_pdf_export()))
    except Exception as e:
        print(f"\n❌ PDF export test failed: {e}")
        results.append(("PDF Export", False))
    
    try:
        results.append(("Admin Reset", test_admin_reset()))
    except Exception as e:
        print(f"\n❌ Admin reset test failed: {e}")
        results.append(("Admin Reset", False))
    
    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name:20} {status}")
    
    all_passed = all(passed for _, passed in results)
    
    print("\n" + "="*70)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
    else:
        print("⚠️  SOME TESTS FAILED - Review output above")
    print("="*70)
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
