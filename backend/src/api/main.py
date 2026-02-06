# backend/src/api/main.py

from __future__ import annotations

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.api.routes.compliance_artifacts import router as compliance_router
from src.api.routes.controlled_substances import router as controlled_substances_router
from src.api.routes.csf_facility import (
    compat_router as csf_facility_v1_router,
    router as csf_facility_router,
)
from src.api.routes.csf_explain import router as csf_explain_router
from src.api.routes.csf_ems import router as csf_ems_router
from src.api.routes.csf_hospital import router as csf_hospital_router
from src.api.routes import csf_practitioner
from src.api.routes.csf_researcher import router as csf_researcher_router
from src.api.routes import decision_history
from src.api.routes import decision_recent
from src.api.routes import verification
from src.api.routes import controlled_substances_item_history
from src.api.routes.license_validation import router as license_router
from src.api.routes.license_ny_pharmacy import router as license_ny_pharmacy_router
from src.api.routes.ohio_tddd import router as ohio_tddd_router
from src.api.routes.ohio_tddd_explain import router as ohio_tddd_explain_router
from src.api.routes.license_ohio_tddd import router as license_ohio_tddd_router
from src.api.routes.pdma_sample import router as pdma_sample_router
from src.api.routes import decision_audit
from src.api.routes.rag_regulatory import (
    router as rag_regulatory_router,
    explain_contract_v1,
)
from src.autocomply.domain.explainability.models import ExplainResult
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
from src.api.routes import console

# Learn After First Unknown - new routes
from src.api.routes import chat
from src.api.routes import admin_review
from src.api.routes import metrics
from src.api.routes import kb_admin
from src.api.routes import demo
from src.api.routes import ops
from src.api.routes import demo_reset
from src.api.routes import agentic
from src.api.routes import audit_packets
from src.api.routes import audit_events
from src.api.routes import policy_contracts
from src.api.routes import policy_safe_failures

# Phase 8.1: Distributed Traces API
from src.api.routes import traces

# Workflow Console - Step 2.10
from app.workflow.router import router as workflow_router

# Intelligence - Phase 7.1
from app.intelligence.router import router as intelligence_router

# Policy - Phase 7.25
from app.policy.router import router as policy_router

# Submissions persistence
from app.submissions.router import router as submissions_router

# Analytics - Step 2.11, 2.12
from app.analytics.router import router as analytics_router
from app.analytics.views_router import router as analytics_views_router

# Development debugging endpoints
from app.dev import router as dev_router

# Scheduled Exports
from app.workflow.scheduled_exports_router import router as scheduled_exports_router

# Admin Operations - ⚠️ DANGEROUS ⚠️
from app.admin.router import router as admin_router

# Spec Trace registry
from app.audit.spec_registry import ensure_demo_specs

# Phase 7.33: Request ID Middleware
from app.middleware import RequestIDMiddleware

# Database initialization
from src.core.db import execute_sql, execute_update, init_db
from src.policy.migrations import ensure_ai_decision_contract

# Get settings
settings = get_settings()


def _table_exists(table_name: str) -> bool:
    rows = execute_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = :table_name",
        {"table_name": table_name},
    )
    return bool(rows)


def _get_table_columns(table_name: str) -> set[str]:
    rows = execute_sql(f"PRAGMA table_info({table_name})")
    return {row.get("name") for row in rows if row.get("name")}


def _ensure_intelligence_history_schema() -> None:
    execute_update(
        """
        CREATE TABLE IF NOT EXISTS intelligence_history (
            id TEXT PRIMARY KEY NOT NULL,
            case_id TEXT NOT NULL,
            computed_at TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            actor TEXT,
            reason TEXT,
            FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
        );
        """
    )

    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_case_id
        ON intelligence_history(case_id, computed_at DESC);
        """
    )
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_created_at
        ON intelligence_history(created_at DESC);
        """
    )


def _ensure_trace_fields_schema() -> None:
    if not _table_exists("intelligence_history"):
        return

    existing_columns = _get_table_columns("intelligence_history")
    trace_columns = {
        "trace_id": "TEXT",
        "span_id": "TEXT",
        "parent_span_id": "TEXT",
        "span_name": "TEXT",
        "span_kind": "TEXT",
        "duration_ms": "INTEGER",
        "error_text": "TEXT",
        "trace_metadata_json": "TEXT",
    }

    for column_name, column_type in trace_columns.items():
        if column_name not in existing_columns:
            execute_update(
                f"ALTER TABLE intelligence_history ADD COLUMN {column_name} {column_type};"
            )

    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_trace_id
        ON intelligence_history(trace_id);
        """
    )
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_span_id
        ON intelligence_history(span_id);
        """
    )
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_intelligence_history_parent_span
        ON intelligence_history(parent_span_id);
        """
    )


def _ensure_policy_overrides_schema() -> None:
    execute_update(
        """
        CREATE TABLE IF NOT EXISTS policy_overrides (
            id TEXT PRIMARY KEY NOT NULL,
            trace_id TEXT NOT NULL,
            submission_id TEXT NOT NULL,
            override_action TEXT NOT NULL,
            rationale TEXT NOT NULL,
            reviewer TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_policy_overrides_trace_id
        ON policy_overrides(trace_id);
        """
    )
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_policy_overrides_submission_id
        ON policy_overrides(submission_id);
        """
    )
    execute_update(
        """
        CREATE INDEX IF NOT EXISTS idx_policy_overrides_created_at
        ON policy_overrides(created_at);
        """
    )


def _ensure_review_queue_notes_schema() -> None:
    if not _table_exists("review_queue_items"):
        return

    existing_columns = _get_table_columns("review_queue_items")
    if "notes" not in existing_columns:
        execute_update("ALTER TABLE review_queue_items ADD COLUMN notes TEXT;")


def _ensure_safe_failure_schema() -> None:
    # Safe failure payloads are embedded in decision/audit JSON; no schema changes required.
    return


def startup_migrations() -> None:
    init_db()
    from src.core.db import get_engine
    from src.database.schema_intelligence import ensure_intelligence_schema

    app_env = settings.APP_ENV.lower()
    engine = get_engine()
    if app_env in {"dev", "ci", "local"} or engine.dialect.name == "sqlite":
        ensure_intelligence_schema(engine)
    _ensure_intelligence_history_schema()
    _ensure_trace_fields_schema()
    _ensure_policy_overrides_schema()
    _ensure_review_queue_notes_schema()
    ensure_ai_decision_contract()
    _ensure_safe_failure_schema()

app = FastAPI(
    title="AutoComply AI – Compliance API",
    version="0.1.0",
    description=(
        "Backend API for AutoComply AI. "
        "Provides deterministic license validation, expiry logic, "
        "attestations, and OCR-backed PDF flows."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# CORS configuration from settings
# =============================================================================
# PRODUCTION SECURITY: In production, CORS_ORIGINS must be set to the exact
# frontend URL (e.g., "https://your-frontend.onrender.com").
# Never use wildcard "*" in production as it allows any origin to access the API.
#
# Development: Can use "*" or "http://localhost:5173" for local development.
# Production: Must specify exact frontend domain in environment variable CORS_ORIGINS.
#
# Example production config:
#   CORS_ORIGINS=https://your-frontend.onrender.com
# =============================================================================

# Phase 7.33: Add request ID middleware for tracing
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup event - initialize database and scheduler
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    """Initialize database and start scheduler on startup."""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Starting AutoComply AI Backend...")
    logger.info(f"  APP_ENV: {settings.APP_ENV}")
    logger.info(f"  RAG_ENABLED: {settings.rag_enabled}")
    logger.info(f"  PORT: {settings.PORT}")
    logger.info(f"  CORS_ORIGINS: {settings.CORS_ORIGINS}")
    logger.info(f"  DB_PATH: {settings.DB_PATH}")
    logger.info(f"  DEMO_SEED: {settings.DEMO_SEED}")
    logger.info(f"")
    logger.info(f"  🚀 API will be available at: http://127.0.0.1:{settings.PORT}")
    logger.info(f"  🏥 Health check: http://127.0.0.1:{settings.PORT}/health")
    logger.info(f"  📊 Workflow API: http://127.0.0.1:{settings.PORT}/workflow")
    logger.info(f"")
    
    # Initialize database and run startup migrations
    logger.info("Initializing database schema...")
    try:
        startup_migrations()
    except Exception:
        logger.exception("Failed during startup migrations")
        raise

    # Seed demo spec registry entries (idempotent)
    ensure_demo_specs()
    
    # Auto-seed demo data if enabled
    if settings.DEMO_SEED:
        logger.info("DEMO_SEED=1 - checking if demo data needed...")
        from app.dev.seed_demo import seed_demo_on_startup
        seed_demo_on_startup()
    
    # Start export scheduler
    logger.info("Starting export scheduler...")
    from app.workflow.scheduler import start_scheduler
    start_scheduler()
    
    logger.info("✓ Startup complete - ready to accept requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop scheduler on shutdown."""
    from app.workflow.scheduler import stop_scheduler
    stop_scheduler()


# ---------------------------------------------------------------------------
# Root health endpoint (for easy frontend access)
# ---------------------------------------------------------------------------
@app.get("/health")
async def root_health():
    """Root health endpoint for frontend connectivity checks."""
    import os
    version = os.getenv("AUTOCOMPLY_VERSION", "0.1.0")
    return {
        "ok": True,
        "status": "ok",
        "service": "autocomply-ai",
        "version": version,
        "checks": {
            "fastapi": "ok",
            "csf_suite": "ok",
            "license_suite": "ok",
            "rag_layer": "ok",
        },
    }


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
app.include_router(csf_practitioner.router)
app.include_router(csf_hospital_router)
app.include_router(csf_researcher_router)
app.include_router(controlled_substances_router)
app.include_router(csf_facility_router)
app.include_router(csf_facility_v1_router)
app.include_router(csf_ems_router)
app.include_router(csf_explain_router)
app.include_router(rag_regulatory_router)
app.include_router(rag_regulatory_router, prefix="/api")
app.add_api_route(
    "/api/rag/explain/v1",
    explain_contract_v1,
    methods=["POST"],
    response_model=ExplainResult,
    tags=["rag_regulatory"],
)
app.include_router(regulatory_search.router)
app.include_router(pdma_sample_router)
app.include_router(decision_history.router)
app.include_router(decision_recent.router)
app.include_router(verification.router)
app.include_router(controlled_substances_item_history.router)
app.include_router(order_mock_router)
app.include_router(order_mock_ny_pharmacy_router)
app.include_router(decision_audit.router)
app.include_router(decision_insights.router)
app.include_router(case_summary.router)
app.include_router(tenant_debug.router)
app.include_router(console.router)
app.include_router(console.router, prefix="/api")

# Learn After First Unknown routes
app.include_router(chat.router)
app.include_router(chat.alias_router)
app.include_router(admin_review.router)

# Phase 8.1: Distributed Traces API
app.include_router(traces.router)
app.include_router(metrics.router)
app.include_router(kb_admin.router)
app.include_router(demo.router)
app.include_router(ops.router)
app.include_router(ops.smoke_router)
app.include_router(demo_reset.router)
app.include_router(agentic.router)
app.include_router(audit_packets.router)
app.include_router(audit_events.router)
app.include_router(policy_contracts.router)
app.include_router(policy_safe_failures.router)


# Workflow Console - Step 2.10
app.include_router(workflow_router)
app.include_router(workflow_router, prefix="/api")

# Intelligence - Phase 7.1
app.include_router(intelligence_router)

# Policy - Phase 7.25
app.include_router(policy_router)

# Submissions persistence
app.include_router(submissions_router)
app.include_router(submissions_router, prefix="/api")

# Analytics - Step 2.11, 2.12
app.include_router(analytics_router)
app.include_router(analytics_views_router)

# Scheduled Exports
app.include_router(scheduled_exports_router)

# Development debugging endpoints (temporary - for diagnosing consistency issues)
app.include_router(dev_router)

# Admin Operations - ⚠️ DANGEROUS - Use with caution ⚠️
app.include_router(admin_router)

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
