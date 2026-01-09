from functools import lru_cache
import os
from pathlib import Path

from pydantic import AnyHttpUrl, BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        default="*",
        description="Comma-separated list of allowed CORS origins (use exact URLs in production)"
    )
    
    # Database
    DB_PATH: str = Field(
        default="app/data/autocomply.db",
        description="SQLite database file path (relative to backend root)"
    )
    
    DATABASE_URL: str = Field(
        default="sqlite:///./app/data/autocomply.db",
        description="SQLite database file path (legacy format)"
    )
    
    # Export directory
    EXPORT_DIR: str = Field(
        default="app/data/exports",
        description="Directory for case export files (relative to backend root)"
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
