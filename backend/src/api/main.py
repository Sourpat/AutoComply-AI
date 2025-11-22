# backend/src/api/main.py

from __future__ import annotations

from datetime import datetime

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.csf_practitioner import router as csf_practitioner_router
from src.api.routes.compliance_artifacts import router as compliance_router
from src.api.routes.license_validation import router as license_router
from src.api.routes.ohio_tddd import router as ohio_tddd_router
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
app.include_router(ohio_tddd_router)
app.include_router(compliance_router)
app.include_router(csf_practitioner_router)

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
# Demo endpoint – expiring licenses for n8n renewal workflow
# ---------------------------------------------------------------------------

@app.get("/demo/expiring-licenses", tags=["demo"])
async def get_demo_expiring_licenses():
    """
    Demo-only endpoint used by the n8n "Renewal Reminders" workflow.

    Returns a small list of licenses that are "expiring soon" so the
    workflow can fan out reminder emails.

    In a real system this would query your customer/license store
    (Airtable, Postgres, JDE, etc.). For now we just return a few
    hard-coded examples with ISO 8601 dates.
    """
    from datetime import date, timedelta

    today = date.today()

    return [
        {
            "name": "Dr. John Smith",
            "email": "john.smith@example.com",
            "license_id": "CA-CSR-123456",
            "state": "CA",
            "state_expiry": (today + timedelta(days=7)).isoformat(),
        },
        {
            "name": "Dr. Priya Rao",
            "email": "priya.rao@example.com",
            "license_id": "NY-CSR-998877",
            "state": "NY",
            "state_expiry": (today + timedelta(days=14)).isoformat(),
        },
        {
            "name": "Dr. Miguel Alvarez",
            "email": "miguel.alvarez@example.com",
            "license_id": "TX-CSR-445566",
            "state": "TX",
            "state_expiry": (today + timedelta(days=25)).isoformat(),
        },
    ]


@app.get("/health", tags=["meta"])
async def health_check() -> dict:
    """
    Lightweight healthcheck for uptime monitors and deployment platforms.

    Returns a simple JSON payload that indicates the service is up,
    along with a UTC timestamp. This endpoint does not call any external
    systems, the LLM, or the RAG pipeline.
    """
    return {
        "status": "ok",
        "service": "autocomply-ai",
        "time": datetime.utcnow().isoformat() + "Z",
    }
