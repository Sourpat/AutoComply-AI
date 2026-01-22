"""
Test: Demo Seed Idempotency

Verifies that demo data seeding is idempotent:
- First call seeds data and returns count > 0
- Subsequent calls return count = 0 (no duplicates)
- Database state is consistent
"""

import pytest
from fastapi.testclient import TestClient
from src.api.main import app
from app.workflow.repo import list_cases
from app.dev.seed_demo import seed_demo_data, is_empty_workflow_db


@pytest.fixture
def client():
    """Test client for API calls."""
    return TestClient(app)


def test_seed_demo_data_idempotency():
    """
    Test that seed_demo_data() is idempotent.
    
    Expected behavior:
    1. First call creates 5 demo cases
    2. Second call creates 0 cases (DB not empty)
    3. Third call creates 0 cases (DB still not empty)
    """
    # Check initial state
    initial_empty = is_empty_workflow_db()
    
    # First seed
    count1 = seed_demo_data()
    
    # Verify cases created on first call
    if initial_empty:
        assert count1 == 5, f"Expected 5 cases on first seed, got {count1}"
    else:
        assert count1 == 0, f"Expected 0 cases (DB not empty), got {count1}"
    
    # Second seed (should create 0 cases)
    count2 = seed_demo_data()
    assert count2 == 0, f"Expected 0 cases on second seed (idempotent), got {count2}"
    
    # Third seed (should still create 0 cases)
    count3 = seed_demo_data()
    assert count3 == 0, f"Expected 0 cases on third seed (idempotent), got {count3}"
    
    # Verify DB has cases
    cases, total = list_cases(limit=100, offset=0)
    assert total >= 5, f"Expected at least 5 cases in DB, got {total}"


def test_seed_endpoint_idempotency(client):
    """
    Test that POST /dev/seed is idempotent.
    
    Expected behavior:
    1. First call seeds data (or returns 0 if already seeded)
    2. Second call returns 0 cases created
    3. Response messages are correct
    """
    # First call
    response1 = client.post("/dev/seed?admin_unlocked=1")
    assert response1.status_code == 200, f"Expected 200, got {response1.status_code}"
    
    data1 = response1.json()
    assert data1["ok"] is True
    assert "cases_created" in data1
    assert "message" in data1
    
    first_count = data1["cases_created"]
    
    # Second call (should return 0)
    response2 = client.post("/dev/seed?admin_unlocked=1")
    assert response2.status_code == 200
    
    data2 = response2.json()
    assert data2["ok"] is True
    assert data2["cases_created"] == 0, f"Expected 0 cases on second call, got {data2['cases_created']}"
    assert "already exists" in data2["message"].lower(), "Expected 'already exists' message"
    
    # Verify total in DB
    cases, total = list_cases(limit=100, offset=0)
    assert total >= 5, f"Expected at least 5 cases in DB, got {total}"


def test_seed_endpoint_with_dev_seed_token(monkeypatch):
    """
    Test POST /dev/seed with DEV_SEED_TOKEN authorization.
    
    Expected behavior:
    1. Valid token allows access
    2. Invalid token returns 403
    3. Missing token returns 403 (when DEV_SEED_TOKEN is set)
    4. admin_unlocked fallback does NOT work when DEV_SEED_TOKEN is set
    """
    # Set DEV_SEED_TOKEN in environment BEFORE creating TestClient
    test_token = "test-seed-token-123"
    monkeypatch.setenv("DEV_SEED_TOKEN", test_token)
    
    # Patch get_settings to return fresh settings with the env var
    from src.config import Settings
    
    def mock_get_settings():
        # Force reload settings from environment
        return Settings()
    
    import app.dev
    monkeypatch.setattr(app.dev, "get_settings", mock_get_settings)
    
    # Create fresh TestClient
    from fastapi.testclient import TestClient
    from src.api.main import app
    client = TestClient(app)
    
    # Test 1: Valid token should succeed
    response_valid = client.post(
        "/dev/seed",
        headers={"Authorization": f"Bearer {test_token}"}
    )
    assert response_valid.status_code == 200, f"Expected 200 with valid token, got {response_valid.status_code}: {response_valid.text}"
    
    # Test 2: Invalid token should fail
    response_invalid = client.post(
        "/dev/seed",
        headers={"Authorization": "Bearer wrong-token"}
    )
    assert response_invalid.status_code == 403, f"Expected 403 with invalid token, got {response_invalid.status_code}: {response_invalid.text}"
    assert "DEV_SEED_TOKEN is configured" in response_invalid.json()["detail"]
    
    # Test 3: Missing Authorization header should fail (when DEV_SEED_TOKEN is set)
    response_no_auth = client.post("/dev/seed")
    assert response_no_auth.status_code == 403, f"Expected 403 with no auth header, got {response_no_auth.status_code}: {response_no_auth.text}"
    
    # Test 4: admin_unlocked should NOT work when DEV_SEED_TOKEN is set
    response_fallback = client.post("/dev/seed?admin_unlocked=1")
    assert response_fallback.status_code == 403, f"Expected 403 with admin_unlocked when token is set, got {response_fallback.status_code}: {response_fallback.text}"
    
    # Test 5: Case-insensitive "bearer" prefix
    response_lowercase = client.post(
        "/dev/seed",
        headers={"Authorization": f"bearer {test_token}"}  # lowercase
    )
    assert response_lowercase.status_code == 200, f"Expected 200 with lowercase bearer, got {response_lowercase.status_code}: {response_lowercase.text}"


def test_is_empty_workflow_db():
    """
    Test is_empty_workflow_db() helper function.
    
    Expected behavior:
    - Returns False if any cases exist
    - Returns True only if DB is completely empty
    """
    # After seeding, DB should not be empty
    seed_demo_data()  # Ensure at least some data exists
    
    empty = is_empty_workflow_db()
    assert empty is False, "Expected DB to not be empty after seeding"
    
    cases, total = list_cases(limit=1, offset=0)
    assert total > 0, f"Expected total > 0, got {total}"


def test_get_workflow_cases_after_seed(client):
    """
    Test that GET /workflow/cases returns cases after seeding.
    
    Expected behavior:
    - After seed, GET /workflow/cases returns total > 0
    - Response contains case items with expected fields
    """
    # Seed data
    client.post("/dev/seed?admin_unlocked=1")
    
    # Fetch cases
    response = client.get("/workflow/cases?limit=100")
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 5, f"Expected at least 5 cases, got {data['total']}"
    
    # Verify case structure
    if data["items"]:
        first_case = data["items"][0]
        assert "id" in first_case
        assert "title" in first_case
        assert "decisionType" in first_case
        assert "status" in first_case


def test_seed_endpoint_disabled_in_production(monkeypatch):
    """Test that /dev/seed is disabled in production by default."""
    from src.config import get_settings
    
    # Clear cache and set production environment
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("DEMO_SEED_ENABLED", raising=False)
    
    client = TestClient(app)
    
    # Should be forbidden even with valid auth
    response = client.post("/dev/seed?admin_unlocked=1")
    assert response.status_code == 403
    assert "disabled in production" in response.json()["detail"].lower()
    
    get_settings.cache_clear()


def test_seed_endpoint_requires_token_in_production(monkeypatch):
    """Test that /dev/seed requires DEV_SEED_TOKEN in production."""
    from src.config import get_settings
    
    # Clear cache and set production with seed enabled but no token
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DEMO_SEED_ENABLED", "true")
    monkeypatch.delenv("DEV_SEED_TOKEN", raising=False)
    
    client = TestClient(app)
    
    # Should require token
    response = client.post("/dev/seed?admin_unlocked=1")
    assert response.status_code == 403
    assert "requires DEV_SEED_TOKEN" in response.json()["detail"]
    
    get_settings.cache_clear()


def test_seed_endpoint_works_in_production_with_both_gates(monkeypatch):
    """Test that /dev/seed works in production with DEMO_SEED_ENABLED=true and valid token."""
    from src.config import get_settings
    
    # Clear cache and set production with both gates enabled
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DEMO_SEED_ENABLED", "true")
    monkeypatch.setenv("DEV_SEED_TOKEN", "prod-test-token")
    
    client = TestClient(app)
    
    # Should work with valid Bearer token
    response = client.post(
        "/dev/seed",
        headers={"Authorization": "Bearer prod-test-token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    
    get_settings.cache_clear()


def test_seed_endpoint_fallback_auth_disabled_in_production(monkeypatch):
    """Test that fallback auth (admin_unlocked) doesn't work in production even with DEMO_SEED_ENABLED."""
    from src.config import get_settings
    
    # Clear cache and set production with seed enabled but no DEV_SEED_TOKEN
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DEMO_SEED_ENABLED", "true")
    monkeypatch.delenv("DEV_SEED_TOKEN", raising=False)
    
    client = TestClient(app)
    
    # Fallback auth should not work in production
    response = client.post("/dev/seed?admin_unlocked=1")
    assert response.status_code == 403
    
    get_settings.cache_clear()

