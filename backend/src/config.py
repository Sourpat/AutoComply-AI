from functools import lru_cache
import os
from pathlib import Path

from pydantic import AnyHttpUrl, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get absolute path to backend root directory (where src/ lives)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DB_PATH = _BACKEND_ROOT / "app" / "data" / "autocomply.db"
_DEFAULT_EXPORT_DIR = _BACKEND_ROOT / "app" / "data" / "exports"


class Settings(BaseSettings):
    """
    Central configuration for AutoComply AI.

    Uses environment variables (from .env in local dev) for:
    - Runtime environment and deployment settings
    - Database and file storage paths
    - CORS origins for API access
    - OpenAI / Gemini keys
    - Optional n8n integration
    """

    # Runtime environment
    APP_ENV: str = Field(
        default="dev",
        description="Application environment: dev or prod"
    )
    
    # Server configuration
    PORT: int = Field(
        default=8001,
        description="Server port"
    )
    
    # CORS configuration
    # =============================================================================
    # PRODUCTION SECURITY WARNING:
    # - Default "*" is for development only
    # - In production, set CORS_ORIGINS to exact frontend URL(s)
    # - Example: CORS_ORIGINS="https://your-frontend.onrender.com"
    # - Multiple origins: CORS_ORIGINS="https://site1.com,https://site2.com"
    # - Never use "*" in production - it allows requests from any origin
    # =============================================================================
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,*",
        description="Comma-separated list of allowed CORS origins (use exact URLs in production)"
    )
    
    # Database (ABSOLUTE PATH - always points to same DB regardless of cwd)
    DB_PATH: str = Field(
        default=str(_DEFAULT_DB_PATH),
        description="SQLite database file path (absolute)"
    )
    
    DATABASE_URL: str = Field(
        default=f"sqlite:///{_DEFAULT_DB_PATH}",
        description="SQLite database URL (absolute path)"
    )
    
    # Export directory (ABSOLUTE PATH)
    EXPORT_DIR: str = Field(
        default=str(_DEFAULT_EXPORT_DIR),
        description="Directory for case export files (absolute)"
    )

    # LLM / embeddings
    OPENAI_API_KEY: str | None = Field(default=None, alias="AUTOCOMPLY_OPENAI_KEY")
    GEMINI_API_KEY: str | None = Field(default=None, alias="AUTOCOMPLY_GEMINI_KEY")

    # RAG features (requires heavy ML dependencies: sentence-transformers, openai, langchain)
    # =============================================================================
    # RAG_ENABLED controls whether RAG features are available.
    # - In production (APP_ENV=prod), defaults to False to avoid requiring heavy ML dependencies
    # - Set RAG_ENABLED=true explicitly if you want RAG features in production
    # - When disabled, RAG endpoints return 501 Not Implemented
    # =============================================================================
    RAG_ENABLED: bool | None = Field(
        default=None,  # Will be computed based on APP_ENV if not explicitly set
        description="Enable RAG features (requires ML dependencies). Auto-disabled in prod unless explicitly enabled."
    )

    # Intelligence lifecycle (Phase 7.4)
    # =============================================================================
    # AUTO_INTELLIGENCE_ENABLED controls whether Decision Intelligence automatically
    # recomputes on case state changes (submission updates, evidence attached, etc.)
    # - Defaults to True for development and production
    # - Set AUTO_INTELLIGENCE_ENABLED=false to disable auto-recompute
    # - When disabled, intelligence only recomputes on explicit API calls
    # =============================================================================
    AUTO_INTELLIGENCE_ENABLED: bool = Field(
        default=True,
        description="Enable automatic Decision Intelligence recomputation on case changes"
    )

    # Demo data seeding (for Render deployment)
    # =============================================================================
    # DEMO_SEED controls whether demo workflow cases are auto-seeded on startup.
    # - Defaults to False (0) for all environments
    # - Set DEMO_SEED=1 on Render to auto-populate demo cases
    # - Only seeds if workflow cases table is empty (idempotent)
    # - Creates realistic cases for csf_practitioner, csf_facility, ohio_tddd, license, csa
    # =============================================================================
    DEMO_SEED: bool = Field(
        default=False,
        description="Auto-seed demo workflow cases on startup if DB is empty"
    )
    
    # DEV_SEED_TOKEN: Optional token for protecting manual POST /dev/seed endpoint
    # - If set, POST /dev/seed requires Authorization: Bearer <token> header
    # - Falls back to admin_unlocked=1 or x-user-role=devsupport if not set
    # - Recommended for production deployments to prevent unauthorized seeding
    DEV_SEED_TOKEN: str | None = Field(
        default=None,
        description="Optional bearer token for POST /dev/seed endpoint protection"
    )

    # Audit Signing (Phase 7.26)
    # =============================================================================
    # AUDIT_SIGNING_SECRET: Secret key for HMAC-SHA256 signing of audit exports
    # - REQUIRED in production for tamper-proof audit trails
    # - Defaults to insecure dev key in development (set proper secret in prod)
    # - Use a strong random string (e.g., openssl rand -hex 32)
    # - Rotate key via AUDIT_SIGNING_KEY_ID when changing secret
    # =============================================================================
    AUDIT_SIGNING_SECRET: str = Field(
        default="dev-insecure-audit-signing-secret-change-in-production",
        description="HMAC secret for signing audit exports (MUST change in production)"
    )
    
    AUDIT_SIGNING_KEY_ID: str = Field(
        default="k1",
        description="Key identifier for audit signing (increment when rotating keys)"
    )
    
    AUDIT_SIGNING_ALG: str = Field(
        default="HMAC-SHA256",
        description="Signing algorithm for audit exports (fixed to HMAC-SHA256)"
    )

    # Runtime (legacy)
    ENV: str = "development"

    # n8n integration (optional)
    AUTOCOMPLY_N8N_BASE_URL: str | None = Field(default=None)
    AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH: str | None = Field(default=None)
    n8n_verification_webhook_url: AnyHttpUrl | None = Field(
        default=None, alias="N8N_VERIFICATION_WEBHOOK_URL"
    )
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS into a list."""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.APP_ENV.lower() in ("prod", "production")
    
    @property
    def rag_enabled(self) -> bool:
        """
        Check if RAG features are enabled.
        
        Auto-disables in production unless explicitly enabled via RAG_ENABLED=true.
        This avoids requiring heavy ML dependencies (sentence-transformers, openai, langchain)
        in production deployments that don't need live RAG features.
        """
        if self.RAG_ENABLED is not None:
            return self.RAG_ENABLED
        # Default: enabled in dev, disabled in prod
        return not self.is_production

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,
    )


class AppConfig(BaseModel):
    """
    Non-secret, app-level config that can be expanded later
    (e.g., feature flags, version info, etc.).
    """

    project_name: str = "AutoComply AI"
    api_prefix: str = "/api/v1"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


@lru_cache()
def get_app_config() -> AppConfig:
    return AppConfig()


def validate_runtime_config() -> dict:
    """
    Validate runtime configuration and return status for /health/details.

    Returns:
        dict with:
        - ok: bool (true if all critical env vars present and valid)
        - missing_env: list[str] (critical env vars that are missing or invalid)
        - warnings: list[str] (non-critical issues that should be addressed)
        - config: dict (boolean flags for feature status, never leak secrets)

    Critical env vars (production must-have):
    - DATABASE_URL: Must be set and non-default
    - AUDIT_SIGNING_SECRET: Must NOT be dev default value in production

    Important env vars (warn if missing):
    - OPENAI_API_KEY or GEMINI_API_KEY: At least one should be present for LLM features
    - DEV_SEED_TOKEN: Should be set in production to protect seed endpoint
    - CORS_ORIGINS: Should NOT be "*" in production
    """
    settings = get_settings()
    missing: list[str] = []
    warnings: list[str] = []

    # Check critical required env
    # DATABASE_URL is always set by Pydantic default, but check it's not obviously wrong
    if not settings.DATABASE_URL or settings.DATABASE_URL == "":
        missing.append("DATABASE_URL")

    # AUDIT_SIGNING_SECRET must not be dev default in production
    dev_audit_secret = "dev-insecure-audit-signing-secret-change-in-production"
    if settings.AUDIT_SIGNING_SECRET == dev_audit_secret:
        if settings.is_production:
            missing.append("AUDIT_SIGNING_SECRET")
        else:
            warnings.append("Using dev audit signing secret (not for production)")

    # Check important optional env
    if not settings.OPENAI_API_KEY and not settings.GEMINI_API_KEY:
        warnings.append("No LLM API keys configured (OPENAI_API_KEY or GEMINI_API_KEY)")

    # Check production security settings
    if settings.is_production:
        if settings.CORS_ORIGINS == "*":
            warnings.append("CORS_ORIGINS set to '*' in production (security risk)")
        if not settings.DEV_SEED_TOKEN:
            warnings.append("DEV_SEED_TOKEN not set (seed endpoint unprotected)")

    # Build config status (booleans only, never leak actual secrets)
    config_status = {
        "database_configured": bool(settings.DATABASE_URL),
        "audit_signing_enabled": bool(settings.AUDIT_SIGNING_SECRET),
        "audit_signing_is_dev_default": settings.AUDIT_SIGNING_SECRET == dev_audit_secret,
        "openai_key_present": bool(settings.OPENAI_API_KEY),
        "gemini_key_present": bool(settings.GEMINI_API_KEY),
        "dev_seed_token_present": bool(settings.DEV_SEED_TOKEN),
        "rag_enabled": settings.rag_enabled,
        "auto_intelligence_enabled": settings.AUTO_INTELLIGENCE_ENABLED,
        "demo_seed_enabled": settings.DEMO_SEED,
        "is_production": settings.is_production,
        "cors_origins_count": len(settings.cors_origins_list),
    }

    return {
        "ok": len(missing) == 0,
        "missing_env": missing,
        "warnings": warnings,
        "config": config_status,
    }
