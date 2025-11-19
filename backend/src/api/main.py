"""Entry point for backend API wiring."""

from fastapi import FastAPI

from .routes.license_validation import router as license_router

app = FastAPI(title="AutoComply API")
app.include_router(license_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Basic readiness probe for early testing."""
    return {"status": "ok"}
