# backend/src/api/main.py

from __future__ import annotations

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.license_validation import router as license_router
from src.api.routes import license_validation as license_validation_module

app = FastAPI(
    title="AutoComply AI – Compliance API",
    version="0.1.0",
    description=(
        "Backend API for AutoComply AI. "
        "Provides deterministic license validation, expiry logic, "
        "attestations, and OCR-backed PDF flows."
    ),
)

# Basic CORS for local dev + Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # safe for demo; tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

# Primary router – all JSON/manual and PDF endpoints live here under:
#   /api/v1/licenses/...
app.include_router(license_router)

# Compatibility endpoint for older/tests path:
# Tests expect: POST /api/v1/license/validate-pdf (singular "license")
# We proxy that to the router's PDF handler so the behavior stays unified.
@app.post("/api/v1/license/validate-pdf")
async def validate_license_pdf_compat(file: UploadFile = File(...)) -> dict:
    """
    Compatibility wrapper for the PDF validation endpoint.

    The main router exposes `/api/v1/licenses/validate-pdf`, but some tests
    (and potential legacy clients) call `/api/v1/license/validate-pdf`.
    This thin wrapper simply delegates to the real handler in
    `src.api.routes.license_validation`.
    """
    return await license_validation_module.validate_license_pdf(file)


# ---------------------------------------------------------------------------
# Health endpoint for smoke tests and uptime checks
# ---------------------------------------------------------------------------

@app.get("/health", tags=["meta"])
async def health() -> dict:
    """
    Simple health check used by smoke tests and deployment probes.
    """
    return {"status": "ok"}
