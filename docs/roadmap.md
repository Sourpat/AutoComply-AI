# AutoComply AI – Roadmap

This roadmap outlines how AutoComply AI evolves from the current
MVP/stubbed implementation into a full GenAI + automation compliance
assistant for DEA and state license workflows.

---

## Phase 0 – Current State (MVP)

Status: ✅ Implemented

- FastAPI backend with:
  - JSON license validation endpoint (`/api/v1/license/validate/json`)
  - PDF validation endpoint (`/api/v1/license/validate-pdf`)
- Shared expiry evaluation (`evaluate_expiry`) wired into the validator.
- Stub OCR extraction (`extract_license_fields_from_pdf`).
- In-memory regulatory knowledge base + `RegulationRetriever`.
- Verdicts include:
  - `allow_checkout`
  - `reason`
  - `regulatory_context` (state + DEA snippets)
- React frontend with manual entry + compliance card.
- n8n workflows stubbed:
  - Email intake → PDF validation → Slack/Airtable
  - Slack alerts webhook
  - Renewal reminders (30/7 days)
- CI pipeline running pytest on every push/PR.
- Documentation:
  - Architecture overview
  - API endpoints
  - Rules/decision engine explained
  - Controlled substance flow (derived from Henry Schein work)
  - Demo script

---

## Phase 1 – OCR & Data Extraction

Goal: Replace the PDF stub with real extraction.

Planned tasks:

- Integrate `pdf2image` or a suitable PDF → image pipeline.
- Add an OCR layer using either:
  - A local OCR engine (e.g., Tesseract), or
  - A vision LLM (Gemini / GPT-4o) via a thin wrapper.
- Implement a parser that converts OCR text into:
  - License number
  - State
  - Expiry
  - Practitioner name
- Add tests for:
  - “Happy path” extraction from synthetic PDFs.
  - Resilience to partial/unclean scans (fallbacks, errors).
- Update the PDF endpoint to:
  - Call the real OCR pipeline.
  - Reuse the same decision engine as the JSON path.

---

## Phase 2 – Real Regulatory RAG

Goal: Attach real, explainable regulatory citations to each verdict.

Planned tasks:

- Replace the in-memory KB with a:
  - Document ingestion pipeline (DEA + state PDFs).
  - Chunking + embedding step.
  - Vector store (Pinecone, Chroma, etc.).
- Implement a `RegulationRetriever` that:
  - Uses embeddings + metadata (jurisdiction, topic).
  - Returns top-K relevant snippets for each decision.
- Extend verdict structure to include:
  - `regulatory_context` with real snippets + citations (source docs).
- Add tests to ensure:
  - At least one relevant snippet is returned for known scenarios.
  - No crash/failure when the vector store is unavailable
    (graceful degradation to rules-only behavior).

---

## Phase 3 – Attestation & Form Logic

Goal: Recreate and enhance attestation / addendum behavior.

Planned tasks:

- Model attestation types (e.g., telemedicine / Ryan Haight, state forms).
- Define when to trigger which attestation modal based on:
  - Product schedule
  - State/ship-to
  - License attributes
- Add endpoints to:
  - Retrieve required attestations for a given cart context.
  - Submit/record attestation decisions.
- Extend frontend:
  - Show attestation modals when required.
  - Display the status of forms/attestations per account.
- Connect RAG/rules to:
  - Explain *why* a particular attestation is required.

---

## Phase 4 – Automation & Ops Hardening

Goal: Make AutoComply feel like a real internal product.

Planned tasks:

- Finish wiring n8n:
  - Real mailbox or mock mail service for intake.
  - Slack workspace integration for alerts.
  - Airtable (or DB) for license & reminder storage.
- Add audit trail endpoints:
  - Record every decision, input, verdict, and context.
  - Provide basic search/filter for compliance review.
- Introduce configuration:
  - Feature flags for OCR/RAG/attestations.
  - Environment-specific settings (dev/stage/prod).
- Improve observability:
  - Structured logging
  - Basic tracing/metrics hooks (e.g., request counts, error rates)

---

## Phase 5 – Production-Ready Polish

Goal: Make the project deployable and demo-ready for serious review.

Planned tasks:

- Harden security:
  - Input validation
  - Authn/Z (even if simple, e.g., API key or basic auth).
- Performance tuning:
  - Async handling of heavy OCR/RAG calls.
  - Caching for repeated license checks.
- Improve UI:
  - Polished compliance cards with clear statuses.
  - Filter/search for past validations.
- Create sample datasets:
  - Synthetic licenses
  - Synthetic controlled substance products
- Finalize story:
  - Case study materials
  - Screenshots and short demo clips

---

## Notes

This roadmap is deliberately incremental:

- Each phase builds on the current architecture.
- Contracts (API responses, verdict structure) are kept stable so the
  frontend and workflows do not need to be rewritten.
- At any point, you can pause on a phase and still have a coherent demo
  and portfolio-ready story.
