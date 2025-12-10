# backend/src/api/main.py

from __future__ import annotations

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.compliance_artifacts import router as compliance_router
from src.api.routes.controlled_substances import router as controlled_substances_router
from src.api.routes.csf_facility import (
    compat_router as csf_facility_v1_router,
    router as csf_facility_router,
)
from src.api.routes.csf_explain import router as csf_explain_router
from src.api.routes.csf_ems import router as csf_ems_router
from src.api.routes.csf_hospital import router as csf_hospital_router
from src.api.routes.csf_practitioner import router as csf_practitioner_router
from src.api.routes.csf_researcher import router as csf_researcher_router
from src.api.routes import decision_history
from src.api.routes import verification
from src.api.routes import controlled_substances_item_history
from src.api.routes.license_validation import router as license_router
from src.api.routes.license_ny_pharmacy import router as license_ny_pharmacy_router
from src.api.routes.ohio_tddd import router as ohio_tddd_router
from src.api.routes.ohio_tddd_explain import router as ohio_tddd_explain_router
from src.api.routes.license_ohio_tddd import router as license_ohio_tddd_router
from src.api.routes.pdma_sample import router as pdma_sample_router
from src.api.routes import decision_audit
from src.api.routes.rag_regulatory import router as rag_regulatory_router
from src.api.routes import regulatory_search
from src.api.routes import license_validation as license_validation_module
from src.api.routes.order_mock_approval import router as order_mock_router
from src.api.routes.order_mock_ny_pharmacy import (
    router as order_mock_ny_pharmacy_router,
)
from src.api.routes.health import router as health_router
from src.api.routes import case_summary
from src.api.routes import decision_insights
from src.api.routes import tenant_debug

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
app.include_router(health_router)
app.include_router(license_router)
app.include_router(license_ohio_tddd_router)
app.include_router(license_ny_pharmacy_router)
app.include_router(ohio_tddd_router)
app.include_router(ohio_tddd_explain_router)
app.include_router(compliance_router)
app.include_router(csf_practitioner_router)
app.include_router(csf_hospital_router)
app.include_router(csf_researcher_router)
app.include_router(controlled_substances_router)
app.include_router(csf_facility_router)
app.include_router(csf_facility_v1_router)
app.include_router(csf_ems_router)
app.include_router(csf_explain_router)
app.include_router(rag_regulatory_router)
app.include_router(regulatory_search.router)
app.include_router(pdma_sample_router)
app.include_router(decision_history.router)
app.include_router(verification.router)
app.include_router(controlled_substances_item_history.router)
app.include_router(order_mock_router)
app.include_router(order_mock_ny_pharmacy_router)
app.include_router(decision_audit.router)
app.include_router(decision_insights.router)
app.include_router(case_summary.router)
app.include_router(tenant_debug.router)

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
