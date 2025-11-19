import os
from functools import lru_cache
from pydantic import BaseSettings


class Settings(BaseSettings):
    """
    Centralized configuration loader for AutoComply AI backend.
    Loads environment variables once and exposes them globally.
    """

    OPENAI_API_KEY: str = os.getenv("AUTOCOMPLY_OPENAI_KEY", "")
    GEMINI_API_KEY: str = os.getenv("AUTOCOMPLY_GEMINI_KEY", "")

    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = ENV == "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings():
    """
    Cached settings loader to avoid reading multiple times.
    """
    return Settings()
