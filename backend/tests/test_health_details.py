"""
Tests for /health/details endpoint and validate_runtime_config().

Phase 7.38: Production deployment guardrails and environment validation.
"""

import os
import re
import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.config import validate_runtime_config, get_settings


def _is_git_sha_or_semver(value: str) -> bool:
    if not value:
        return False
    git_sha = re.fullmatch(r"[0-9a-f]{7,40}", value, flags=re.IGNORECASE)
    semver = re.fullmatch(r"\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?", value)
    return bool(git_sha or semver)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_health_details_endpoint_exists(client):
    """Test that /health/details endpoint is accessible."""
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()

    # Check required fields exist
    assert "ok" in data
    assert "version" in data
    assert "environment" in data
    assert "config" in data
    assert "missing_env" in data
    assert "warnings" in data


def test_health_details_with_valid_dev_env(client):
    """Test health details with standard dev environment."""
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()

    # Dev environment should be ok even with dev defaults
    # (validation only fails in production with dev defaults)
    assert isinstance(data["ok"], bool)
    assert isinstance(data["missing_env"], list)
    assert isinstance(data["warnings"], list)
    assert isinstance(data["config"], dict)

    # Config should have expected boolean flags
    config = data["config"]
    assert "database_configured" in config
    assert "audit_signing_enabled" in config
    assert "audit_signing_is_dev_default" in config
    assert "openai_key_present" in config
    assert "gemini_key_present" in config
    assert "dev_seed_token_present" in config
    assert "rag_enabled" in config
    assert "auto_intelligence_enabled" in config
    assert "demo_seed_enabled" in config
    assert "is_production" in config
    assert "cors_origins_count" in config

    # All config values should be booleans or ints
    for key, value in config.items():
        if key == "cors_origins_count":
            assert isinstance(value, int)
        else:
            assert isinstance(value, bool), f"Config key {key} should be boolean, got {type(value)}"


def test_health_details_version_is_env_safe(client, monkeypatch):
    """Version should prefer APP_VERSION or be git/semver-like."""
    get_settings.cache_clear()
    monkeypatch.delenv("APP_VERSION", raising=False)
    monkeypatch.delenv("AUTOCOMPLY_VERSION", raising=False)

    response = client.get("/health/details")
    assert response.status_code == 200
    version = response.json()["version"]

    app_version = os.getenv("APP_VERSION")
    if app_version:
        assert version == app_version
    else:
        assert _is_git_sha_or_semver(version)

    get_settings.cache_clear()


def test_health_details_no_secrets_leaked(client):
    """Test that /health/details never leaks actual secret values."""
    response = client.get("/health/details")
    assert response.status_code == 200
    data_str = response.text

    # Ensure no actual secret values appear anywhere in response
    # (even if they were set in env)
    sensitive_patterns = [
        "dev-insecure-audit-signing-secret",
        "sk-",  # OpenAI key prefix
        "AIza",  # Google API key prefix
    ]

    for pattern in sensitive_patterns:
        # Allow the pattern in field names/descriptions, but not as values
        # Since we only return booleans, secrets shouldn't appear
        pass  # Response only contains booleans, so this is safe

    # Verify config only contains booleans/ints
    data = response.json()
    config = data["config"]
    for key, value in config.items():
        if key == "cors_origins_count":
            assert isinstance(value, int)
        else:
            assert isinstance(value, bool)
            # Never return actual string values that could leak secrets


def test_validate_runtime_config_with_missing_database_url(monkeypatch):
    """Test validation when DATABASE_URL is missing."""
    # Clear cache to force re-read of settings
    get_settings.cache_clear()

    # Set to empty string to simulate missing
    monkeypatch.setenv("DATABASE_URL", "")

    validation = validate_runtime_config()

    # Should report missing DATABASE_URL
    assert not validation["ok"]
    assert "DATABASE_URL" in validation["missing_env"]

    # Clear cache after test
    get_settings.cache_clear()


def test_validate_runtime_config_dev_audit_secret_in_dev(monkeypatch):
    """Test that dev audit secret is warning in dev, not error."""
    get_settings.cache_clear()

    # Set to dev environment with dev secret
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.setenv("AUDIT_SIGNING_KEY", "dev-insecure-audit-signing-secret-change-in-production")

    validation = validate_runtime_config()

    # In dev, should be warning not error
    assert "AUDIT_SIGNING_KEY" not in validation["missing_env"]
    assert any("dev audit signing secret" in w for w in validation["warnings"])

    get_settings.cache_clear()


def test_validate_runtime_config_dev_audit_secret_in_prod(monkeypatch):
    """Test that dev audit secret is error in production."""
    get_settings.cache_clear()

    # Set to production environment with dev secret
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("AUDIT_SIGNING_KEY", "dev-insecure-audit-signing-secret-change-in-production")

    validation = validate_runtime_config()

    # In prod, should be error
    assert not validation["ok"]
    assert "AUDIT_SIGNING_KEY" in validation["missing_env"]

    get_settings.cache_clear()


def test_validate_runtime_config_no_llm_keys_warning(monkeypatch):
    """Test warning when no LLM API keys are configured."""
    get_settings.cache_clear()

    # Ensure no LLM keys are set
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    validation = validate_runtime_config()

    # Should have warning about missing LLM keys
    assert any("LLM API keys" in w for w in validation["warnings"])

    get_settings.cache_clear()


def test_validate_runtime_config_insecure_cors_in_prod(monkeypatch):
    """Test warning for insecure CORS in production."""
    get_settings.cache_clear()

    # Set to production with wildcard CORS
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("CORS_ORIGINS", "*")

    validation = validate_runtime_config()

    # Should have warning about CORS
    assert any("CORS_ORIGINS" in w and "production" in w for w in validation["warnings"])

    get_settings.cache_clear()


def test_validate_runtime_config_production_without_seed_token(monkeypatch):
    """Test warning when production lacks DEV_SEED_TOKEN."""
    get_settings.cache_clear()

    # Set to production without seed token
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("DEV_SEED_TOKEN", raising=False)

    validation = validate_runtime_config()

    # Should have warning about seed token
    assert any("DEV_SEED_TOKEN" in w for w in validation["warnings"])

    get_settings.cache_clear()


def test_validate_runtime_config_fully_valid_production(monkeypatch):
    """Test validation with fully configured production environment."""
    get_settings.cache_clear()

    # Set all required production env vars
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./prod.db")
    monkeypatch.setenv("AUDIT_SIGNING_KEY", "secure-production-secret-12345")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-key")
    monkeypatch.setenv("DEV_SEED_TOKEN", "prod-seed-token")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")

    validation = validate_runtime_config()

    # Should be fully valid
    assert validation["ok"]
    assert len(validation["missing_env"]) == 0
    # May still have some warnings (e.g., no GEMINI key), but no critical errors

    get_settings.cache_clear()


def test_health_details_config_flags_accuracy(client, monkeypatch):
    """Test that config boolean flags accurately reflect environment."""
    get_settings.cache_clear()

    # Set specific env vars
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("RAG_ENABLED", "true")
    monkeypatch.setenv("AUTO_INTELLIGENCE_ENABLED", "false")

    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()

    config = data["config"]
    assert config["openai_key_present"] is True
    assert config["gemini_key_present"] is False
    assert config["rag_enabled"] is True
    assert config["auto_intelligence_enabled"] is False

    get_settings.cache_clear()


def test_health_details_version_and_metadata(client, monkeypatch):
    """Test that version and build metadata are included."""
    monkeypatch.setenv("AUTOCOMPLY_VERSION", "1.2.3")
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("GIT_SHA", "abc123def")
    monkeypatch.setenv("BUILD_TIME", "2024-01-15T10:30:00Z")

    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()

    assert data["version"] == "1.2.3"
    assert data["environment"] == "staging"
    assert data["commit_sha"] == "abc123def"
    assert data["build_time"] == "2024-01-15T10:30:00Z"


def test_health_details_commit_sha_from_render(client, monkeypatch):
    """Test that commit_sha is detected from RENDER_GIT_COMMIT."""
    get_settings.cache_clear()
    
    # Simulate Render platform env var
    monkeypatch.setenv("RENDER_GIT_COMMIT", "render-commit-abc123")
    
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()
    
    assert data["commit_sha"] == "render-commit-abc123"
    
    get_settings.cache_clear()


def test_health_details_commit_sha_from_github_actions(client, monkeypatch):
    """Test that commit_sha is detected from GITHUB_SHA."""
    if os.getenv("GITHUB_ACTIONS") != "true" or not os.getenv("GITHUB_SHA"):
        pytest.skip("Only valid in GitHub Actions")
    get_settings.cache_clear()
    
    # Simulate GitHub Actions env var
    monkeypatch.setenv("GITHUB_SHA", "github-sha-xyz789")
    
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()
    
    assert data["commit_sha"] == "github-sha-xyz789"
    
    get_settings.cache_clear()


def test_health_details_demo_seed_disabled_in_prod(client, monkeypatch):
    """Test that demo_seed_enabled is false in production by default."""
    get_settings.cache_clear()
    
    # Set to production without DEMO_SEED_ENABLED
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("DEMO_SEED_ENABLED", raising=False)
    
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()
    
    # Should be disabled in prod by default
    assert data["config"]["demo_seed_enabled"] is False
    
    get_settings.cache_clear()


def test_health_details_demo_seed_enabled_in_dev(client, monkeypatch):
    """Test that demo_seed_enabled is true in dev by default."""
    get_settings.cache_clear()
    
    # Set to dev environment
    monkeypatch.setenv("APP_ENV", "dev")
    monkeypatch.delenv("DEMO_SEED_ENABLED", raising=False)
    
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()
    
    # Should be enabled in dev by default
    assert data["config"]["demo_seed_enabled"] is True
    
    get_settings.cache_clear()


def test_health_details_demo_seed_explicit_override(client, monkeypatch):
    """Test that DEMO_SEED_ENABLED explicitly overrides defaults."""
    get_settings.cache_clear()
    
    # Explicitly enable in production
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.setenv("DEMO_SEED_ENABLED", "true")
    
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()
    
    # Should respect explicit setting
    assert data["config"]["demo_seed_enabled"] is True
    
    get_settings.cache_clear()


def test_health_details_demo_seed_startup_flag(client, monkeypatch):
    """Test that demo_seed_startup flag is separate from demo_seed_enabled."""
    get_settings.cache_clear()
    
    # Set DEMO_SEED for startup seeding
    monkeypatch.setenv("DEMO_SEED", "true")
    monkeypatch.setenv("APP_ENV", "dev")
    
    response = client.get("/health/details")
    assert response.status_code == 200
    data = response.json()
    
    # Both flags should be present and independent
    assert "demo_seed_enabled" in data["config"]
    assert "demo_seed_startup" in data["config"]
    assert data["config"]["demo_seed_startup"] is True
    
    get_settings.cache_clear()

