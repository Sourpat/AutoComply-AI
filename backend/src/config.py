from functools import lru_cache

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central configuration for AutoComply AI.

    Uses environment variables (from .env in local dev) for:
    - OpenAI / Gemini keys
    - Runtime environment
    - Optional n8n integration
    """

    # LLM / embeddings
    OPENAI_API_KEY: str | None = Field(default=None, alias="AUTOCOMPLY_OPENAI_KEY")
    GEMINI_API_KEY: str | None = Field(default=None, alias="AUTOCOMPLY_GEMINI_KEY")

    # Runtime
    ENV: str = "development"

    # n8n integration (optional)
    AUTOCOMPLY_N8N_BASE_URL: str | None = Field(default=None)
    AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH: str | None = Field(default=None)

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
