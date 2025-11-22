# backend/src/api/routes/license_validation.py

from __future__ import annotations

import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, File, HTTPException, UploadFile

from src.api.models.compliance_models import (
    LicenseValidationRequest,
    LicenseValidationResponse,
    RegulatoryContextResponse,
    RegulatoryContextRequest,
)
from src.compliance.decision_engine import ComplianceEngine
from src.ocr.extract import extract_text_from_pdf, parse_license_fields_from_text
from src.rag.retriever import RegulationRetriever, build_regulatory_context
from src.rag.responder import explain_verdict_with_context
from src.utils.events import get_event_publisher

router = APIRouter(
    prefix="/api/v1/licenses",
    tags=["license-validation"],
)


@router.post(
    "/validate/license",
    response_model=LicenseValidationResponse,
    summary="Validate a license via JSON/manual payload",
)
async def validate_license(payload: LicenseValidationRequest) -> dict:
    """
    Validate a license based on JSON/manual input from the frontend.

    This is the primary endpoint used by the manual entry form.
    It delegates to the ComplianceEngine for deterministic decisions
    and also emits a non-blocking event that can be consumed by n8n
    or other automation tools.
    """
    engine = ComplianceEngine()
    verdict = engine.evaluate(payload)
    verdict_dict = verdict.dict()

    # --- Attach RAG-style regulatory context for this decision ---
    state_code = verdict_dict.get("state") or payload.state

    try:
        raw_context = build_regulatory_context(
            state=state_code,
            purchase_intent=payload.purchase_intent,
        )
    except Exception:
        # Never break the API on context-building issues; fall back to empty.
        raw_context = []

    normalized_context = []
    seen_jurisdictions = set()

    for item in raw_context or []:
        # Support both dicts and simple objects (Pydantic/dataclasses).
        if isinstance(item, dict):
            jurisdiction = item.get("jurisdiction")
            snippet = item.get("snippet") or item.get("text") or ""
            source = item.get("source") or ""
        else:
            jurisdiction = getattr(item, "jurisdiction", None)
            snippet = getattr(item, "snippet", "") or getattr(item, "text", "")
            source = getattr(item, "source", "")

        if not jurisdiction and state_code:
            jurisdiction = f"US-{state_code}"

        normalized_item = {
            "jurisdiction": jurisdiction,
            "snippet": snippet,
            "source": source,
        }
        normalized_context.append(normalized_item)

        if jurisdiction:
            seen_jurisdictions.add(jurisdiction)

    # Ensure at least one state-level and one DEA-level snippet are present.
    if state_code and f"US-{state_code}" not in seen_jurisdictions:
        normalized_context.append(
            {
                "jurisdiction": f"US-{state_code}",
                "snippet": f"Generic state-level guidance for {state_code} (stub).",
                "source": "STATE-RAG",
            }
        )
        seen_jurisdictions.add(f"US-{state_code}")

    if "US-DEA" not in seen_jurisdictions:
        normalized_context.append(
            {
                "jurisdiction": "US-DEA",
                "snippet": "DEA controlled-substance baseline requirement (stub).",
                "source": "DEA-RAG",
            }
        )
        seen_jurisdictions.add("US-DEA")

    verdict_dict["regulatory_context"] = normalized_context

    explanation = explain_verdict_with_context(
        verdict_dict,
        regulatory_context=normalized_context,
    )

    response = {
        "success": True,
        "verdict": verdict_dict,
        "explanation": explanation,
    }

    # --- Fire-and-forget event to n8n (optional) ---
    publisher = get_event_publisher()

    if isinstance(response, dict):
        event_verdict = response.get("verdict") or {}
        event_payload = {
            "event": "license_validation",
            "success": bool(response.get("success", True)),
            "license_id": event_verdict.get("license_id"),
            "state": event_verdict.get("state"),
            "allow_checkout": event_verdict.get("allow_checkout"),
        }

        # Do not block the API on alert errors.
        # Be defensive: support either `send_event` (new) or `send_slack_alert` (older stub),
        # and no-op if neither exists.
        send_coro = None
        if hasattr(publisher, "send_event"):
            send_coro = getattr(publisher, "send_event")
        elif hasattr(publisher, "send_slack_alert"):
            send_coro = getattr(publisher, "send_slack_alert")

        if callable(send_coro):
            try:
                asyncio.create_task(send_coro(event_payload))
            except Exception:
                # Never let event errors impact the main API flow.
                pass

    return response


@router.post(
    "/validate-pdf",
    summary="Validate a license from an uploaded PDF",
)
async def validate_license_pdf(file: UploadFile = File(...)) -> dict:
    """
    Validate a license based on an uploaded PDF.

    Pipeline:
    - Uses the OCR stub to extract raw text from the PDF.
    - Parses the text for likely state / permit / expiry fields.
    - Falls back to safe defaults if parsing fails.
    - Runs the same ComplianceEngine used by the JSON/manual path.
    - Returns the engine verdict plus an `extracted_fields` block
      that the frontend can show under “Extracted from document”.
    """
    if not file:
        raise HTTPException(status_code=400, detail="PDF file is required.")

    # Basic content-type guard. We keep it permissive for tests/demos.
    if file.content_type not in (
        "application/pdf",
        "application/octet-stream",
        "binary/octet-stream",
        "",
        None,
    ):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # --- OCR stub: get raw text from PDF bytes ---
    try:
        raw_text = extract_text_from_pdf(file_bytes)
    except Exception as exc:
        # In a real system we'd log + return a structured error.
        # For this demo we keep it simple but still return 200 with a safe verdict.
        raw_text = f"OCR_ERROR: {exc}"

    text_preview = (raw_text or "").strip()
    if len(text_preview) > 400:
        text_preview = text_preview[:400] + "…"

    # Minimal extracted info we expose to the frontend.
    extracted_fields: dict = {
        "file_name": file.filename or "uploaded.pdf",
        "text_preview": text_preview or "[no text extracted]",
        "character_count": len(raw_text or ""),
    }

    # --- Parse fields from OCR text (best-effort) -----------------------
    parsed = parse_license_fields_from_text(raw_text or "")

    # Defaults if parsing fails
    today = date.today()
    default_expiry_iso = (today + timedelta(days=365)).isoformat()

    parsed_state = parsed.get("state") or "CA"
    parsed_permit = (
        parsed.get("state_permit")
        or parsed.get("license_id")
        or "AUTO-PDF-PERMIT"
    )
    parsed_expiry = parsed.get("state_expiry") or default_expiry_iso

    extracted_fields.update(
        {
            "parsed_state": parsed_state,
            "parsed_state_permit": parsed_permit,
            "parsed_state_expiry": parsed_expiry,
        }
    )

    # --- Build LicenseValidationRequest with parsed fields --------------
    license_payload = LicenseValidationRequest(
        practice_type="Standard",
        state=parsed_state,
        state_permit=parsed_permit,
        state_expiry=parsed_expiry,
        purchase_intent="GeneralMedicalUse",
        quantity=1,
    )

    engine = ComplianceEngine()
    verdict = engine.evaluate(license_payload)
    verdict_dict = verdict.dict()

    # --- Attach RAG-style regulatory context for this PDF-based decision ---
    state_code = verdict_dict.get("state") or license_payload.state

    try:
        regulatory_context = build_regulatory_context(
            state=state_code,
            purchase_intent=license_payload.purchase_intent,
        )
    except Exception:
        # Never break the API on context-building issues; fall back to empty.
        regulatory_context = []

    verdict_dict["regulatory_context"] = regulatory_context

    response = {
        "success": True,
        "verdict": verdict_dict,
        "extracted_fields": extracted_fields,
    }

    return response


@router.post(
    "/debug/regulatory-context",
    summary="Debug regulatory context for a given state and purchase intent",
)
async def debug_regulatory_context(payload: LicenseValidationRequest) -> dict:
    """
    Debug-only endpoint that exposes:
    - the raw RAG retrieval hits from RegulationRetriever
    - the normalized regulatory_context that the engine uses in verdicts

    This is meant for demos and troubleshooting and should not be used
    as a customer-facing API.
    """
    retriever = RegulationRetriever()

    # Raw hits from the retriever (e.g., Pinecone/Chroma in a future version)
    raw_hits = retriever.retrieve(
        state=payload.state,
        purchase_intent=payload.purchase_intent,
    )

    # Normalized context using the same helper wiring used by the main endpoint
    normalized_context = build_regulatory_context(
        state=payload.state,
        purchase_intent=payload.purchase_intent,
    )

    return {
        "success": True,
        "input": {
            "state": payload.state,
            "purchase_intent": payload.purchase_intent,
        },
        "raw_retrieval": raw_hits,
        "normalized_context": normalized_context,
    }


@router.post(
    "/explain-rule",
    response_model=RegulatoryContextResponse,
    summary="Explain the regulatory rules for a given state + scenario",
)
async def explain_rule(payload: RegulatoryContextRequest) -> dict:
    """
    Lightweight RAG-powered helper endpoint.

    Given a state and a purchase intent (scenario), returns the
    regulatory context snippets that inform the decision engine.

    This is ideal for:
      - "Why is this blocked?"
      - "Show me the rule behind this decision."
    """
    try:
        raw_context = build_regulatory_context(
            state=payload.state,
            purchase_intent=payload.purchase_intent,
        )
    except Exception:
        # Never break the explainer on RAG issues; fall back to empty list.
        raw_context = []

    context_items: list[dict] = []

    for item in raw_context or []:
        # Handle both dicts and simple objects from the retriever layer.
        if isinstance(item, dict):
            jurisdiction = item.get("jurisdiction")
            snippet = item.get("snippet") or item.get("text") or ""
            source = item.get("source") or ""
        else:
            jurisdiction = getattr(item, "jurisdiction", None)
            snippet = getattr(item, "snippet", "") or getattr(item, "text", "")
            source = getattr(item, "source", "")

        if not snippet:
            # Skip empty snippets to avoid noisy entries.
            continue

        context_items.append(
            {
                "jurisdiction": jurisdiction,
                "snippet": snippet,
                "source": source,
            }
        )

    return {
        "success": True,
        "state": payload.state,
        "purchase_intent": payload.purchase_intent,
        "items": context_items,
        "context": context_items,
    }


@router.get(
    "/rules/context",
    response_model=RegulatoryContextResponse,
    summary="Preview regulatory context (RAG snippets) for a given state and scenario",
)
async def get_regulatory_context(state: str, purchase_intent: str) -> dict:
    """
    Return only the regulatory_context snippets for a given
    state + purchase_intent combination.
    This endpoint:
    - calls the same RAG helper used by the main decision engine
    - never raises on retrieval errors (it just returns an empty list)
    - is ideal for UI 'peek' features or debugging which rules were consulted.
    """

    try:
        context = build_regulatory_context(
            state=state,
            purchase_intent=purchase_intent,
        )
    except Exception:
        context = []

    return {
        "success": True,
        "items": context,
    }

# ---------------------------------------------------------------------------
# Backwards-compatible export
# ---------------------------------------------------------------------------
# Some parts of the codebase (and tests) still import `singular_router`
# from this module. We keep that alias pointing at the main router so
# those imports continue to work without changing behavior.
singular_router = router
