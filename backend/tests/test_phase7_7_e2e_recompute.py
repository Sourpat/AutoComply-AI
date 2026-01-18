"""
PHASE 7.7 E2E Intelligence Recompute Integration Test

Tests the complete recompute flow with actual HTTP calls:
1) GET intelligence
2) Recompute with admin_unlocked=1
3) GET again to verify fresh data
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from app.workflow.repo import create_case
from app.workflow.models import CaseCreateInput


client = TestClient(app)


@pytest.fixture
def test_case():
    """Create a test case for E2E testing."""
    case = create_case(
        CaseCreateInput(
            decisionType="csf",
            title="Phase 7.7 E2E Test Case",
            summary="Testing intelligence recompute flow"
        )
    )
    return case


def test_e2e_intelligence_get_recompute_refresh(test_case):
    """
    Test complete intelligence flow:
    1) GET intelligence (baseline)
    2) POST recompute with admin_unlocked=1 (no 403)
    3) GET again to verify data is fresh
    """
    case_id = test_case.id
    
    print(f"\n[Test] Using case: {case_id}")
    
    # ========================================================================
    # Step 1: GET intelligence (baseline)
    # ========================================================================
    
    print("\n[1/3] GET intelligence (baseline)...")
    response = client.get(f"/workflow/cases/{case_id}/intelligence")
    assert response.status_code == 200, f"GET failed: {response.text}"
    
    baseline = response.json()
    print(f"  Baseline confidence: {baseline['confidence_score']}% ({baseline['confidence_band']})")
    print(f"  Gaps: {len(baseline.get('gaps', []))}")
    print(f"  Computed at: {baseline['computed_at']}")
    
    assert baseline["case_id"] == case_id
    assert "confidence_score" in baseline
    assert baseline["confidence_score"] >= 5.0, "Should have minimum 5% floor"
    baseline_timestamp = baseline["computed_at"]
    
    # ========================================================================
    # Step 2: Recompute with admin_unlocked=1
    # ========================================================================
    
    print("\n[2/3] POST recompute (admin_unlocked=1)...")
    response = client.post(
        f"/workflow/cases/{case_id}/intelligence/recompute?admin_unlocked=1"
    )
    assert response.status_code == 200, f"Recompute failed: {response.text}"
    
    recomputed = response.json()
    print(f"  New confidence: {recomputed['confidence_score']}% ({recomputed['confidence_band']})")
    print(f"  Gaps: {len(recomputed.get('gaps', []))}")
    print(f"  Computed at: {recomputed['computed_at']}")
    
    assert recomputed["case_id"] == case_id
    assert recomputed["confidence_score"] >= 5.0, "Should maintain 5% floor"
    
    # ========================================================================
    # Step 3: GET again - verify cache consistency
    # ========================================================================
    
    print("\n[3/3] GET intelligence again (verify refresh)...")
    response = client.get(f"/workflow/cases/{case_id}/intelligence")
    assert response.status_code == 200, f"GET failed: {response.text}"
    
    refetch = response.json()
    print(f"  Refetched confidence: {refetch['confidence_score']}%")
    print(f"  Refetched timestamp: {refetch['computed_at']}")
    
    # Verify data consistency
    assert refetch["confidence_score"] == recomputed["confidence_score"], \
        "GET should return same confidence as recompute"
    
    print("\n=== E2E Test Summary ===")
    print("OK: GET intelligence works")
    print("OK: POST recompute (admin_unlocked=1) works without 403")
    print("OK: GET refresh returns consistent data")
    print(f"OK: Final confidence: {refetch['confidence_score']}% ({refetch['confidence_band']})")


def test_recompute_admin_unlocked_query_param_works(test_case):
    """Verify admin_unlocked=1 query param allows recompute."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute?admin_unlocked=1"
    )
    assert response.status_code == 200, f"Expected 200 with admin_unlocked=1, got {response.status_code}"
    print("\nOK: Recompute with admin_unlocked=1 works")


def test_recompute_without_auth_blocked(test_case):
    """Verify recompute without auth returns 403."""
    response = client.post(
        f"/workflow/cases/{test_case.id}/intelligence/recompute"
    )
    assert response.status_code == 403, "Should get 403 without auth"
    print("\nOK: Recompute correctly blocked without admin_unlocked=1")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

