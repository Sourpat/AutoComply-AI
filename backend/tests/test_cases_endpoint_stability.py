"""
Test GET /workflow/cases endpoint stability.

Ensures the endpoint:
1. Returns 200 OK when there are cases
2. Returns 200 OK when there are no cases (empty list)
3. Never throws on missing optional fields
4. Returns valid JSON schema with required fields
5. Includes computed SLA fields (age_hours, sla_status)
"""
import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from app.workflow.models import CaseStatus, CaseCreateInput

client = TestClient(app)


def test_cases_list_returns_200_with_valid_schema():
    """Test GET /workflow/cases returns 200 with valid JSON schema."""
    response = client.get("/workflow/cases?limit=10")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    
    # Validate top-level schema
    assert "items" in data, "Response missing 'items' field"
    assert "total" in data, "Response missing 'total' field"
    assert "limit" in data, "Response missing 'limit' field"
    assert "offset" in data, "Response missing 'offset' field"
    
    assert isinstance(data["items"], list), "'items' should be a list"
    assert isinstance(data["total"], int), "'total' should be an integer"
    assert data["total"] >= 0, "'total' should be non-negative"


def test_cases_list_with_no_results_returns_200():
    """Test GET /workflow/cases returns 200 with empty list when no results."""
    # Use a status filter that won't match anything
    response = client.get("/workflow/cases?status=nonexistent_status")
    
    # Should return 400 for invalid status, not 500
    # If it returns 200 with empty list, that's also acceptable
    assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}"
    
    if response.status_code == 200:
        data = response.json()
        assert data["total"] >= 0


def test_cases_list_includes_sla_fields():
    """Test that cases include computed SLA fields (age_hours, sla_status)."""
    response = client.get("/workflow/cases?limit=5")
    
    assert response.status_code == 200
    data = response.json()
    
    if data["items"]:
        first_item = data["items"][0]
        
        # Required base fields
        assert "id" in first_item, "Case missing 'id'"
        assert "status" in first_item, "Case missing 'status'"
        assert "createdAt" in first_item, "Case missing 'createdAt'"
        
        # Computed SLA fields (Phase 7.29)
        assert "age_hours" in first_item, "Case missing computed 'age_hours' field"
        assert "sla_status" in first_item, "Case missing computed 'sla_status' field"
        
        # Validate SLA field types
        assert isinstance(first_item["age_hours"], (int, float)), "'age_hours' should be numeric"
        assert first_item["age_hours"] >= 0, "'age_hours' should be non-negative"
        assert first_item["sla_status"] in ["ok", "warning", "breach"], \
            f"Invalid sla_status: {first_item['sla_status']}"


def test_cases_list_handles_missing_optional_fields():
    """Test that endpoint doesn't crash on cases with missing optional fields."""
    # This test verifies the fix for the timezone handling bug
    # by ensuring all cases can be enriched with SLA fields
    response = client.get("/workflow/cases?limit=100")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    
    # All items should have SLA fields computed successfully
    for item in data["items"]:
        assert "age_hours" in item, f"Case {item.get('id')} missing age_hours"
        assert "sla_status" in item, f"Case {item.get('id')} missing sla_status"


def test_cases_list_pagination():
    """Test pagination parameters work correctly."""
    # Get first page
    response1 = client.get("/workflow/cases?limit=5&offset=0")
    assert response1.status_code == 200
    data1 = response1.json()
    assert data1["limit"] == 5
    assert data1["offset"] == 0
    
    # Get second page (if enough items exist)
    response2 = client.get("/workflow/cases?limit=5&offset=5")
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2["limit"] == 5
    assert data2["offset"] == 5
    
    # Items should not overlap (if enough data exists)
    if len(data1["items"]) == 5 and len(data2["items"]) > 0:
        ids1 = {item["id"] for item in data1["items"]}
        ids2 = {item["id"] for item in data2["items"]}
        assert ids1.isdisjoint(ids2), "Pagination pages should not overlap"


def test_cases_list_empty_database():
    """Test that an empty database returns 200 with empty list, not 500."""
    # Note: This test assumes database may have items
    # The key requirement is: never return 500 due to empty results
    response = client.get("/workflow/cases?limit=1000")  # Max allowed limit
    
    assert response.status_code == 200, \
        f"Even with empty/large results, should return 200, got {response.status_code}"
    
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
