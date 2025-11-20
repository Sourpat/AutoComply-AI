from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.api.routes.license_validation import (
    router as license_router,
    singular_router as license_singular_router,
)


def create_app() -> FastAPI:
    """
    Factory to create FastAPI app instance.
    Keeps things organized and scalable.
    """
    settings = get_settings()

    app = FastAPI(
        title="AutoComply AI Backend",
        version="0.1.0",
        description="Compliance engine for DEA & state license validation"
    )

    # ---- CORS ----
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],      # You can restrict this later
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- ROUTES ----
    app.include_router(license_router, prefix="/api/v1", tags=["Compliance"])
    app.include_router(license_singular_router, prefix="/api/v1", tags=["Compliance"])

    # ---- HEALTH CHECK ----
    @app.get("/health")
    async def health():
        return {"status": "ok", "environment": settings.ENV}

    return app


app = create_app()
