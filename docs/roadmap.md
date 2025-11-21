# AutoComply AI – Roadmap

This roadmap describes how AutoComply AI can evolve from its current
sandbox implementation into a richer, AI-native compliance co-pilot.

The key principles:

- Preserve deterministic, testable core logic.
- Add AI/OCR/RAG features behind clear, modular interfaces.
- Keep automation (n8n, Slack, email) opt-in and safe-by-default.

---

## 0. Current State (Baseline)

Today, AutoComply AI includes:

- **Backend (FastAPI)**
  - JSON license validation endpoint
    - `/api/v1/licenses/validate/license`
  - PDF license validation endpoint
    - `/api/v1/licenses/validate-pdf`
  - Expiry engine (`evaluate_expiry`) with tests
  - Compliance engine (`ComplianceEngine`) for decisions
  - Stub OCR pipeline (`StubOcrPipeline`)
  - Stub regulatory context (`RegulationRetriever` / in-memory snippets)
  - EventPublisher (NO-OP by default, wired for future n8n/Slack)

- **Frontend (React + Vite)**
  - Manual entry form for license details
  - PDF upload for scanned/emailed licenses
  - Compliance card for verdict + regulatory context

- **Automation**
  - EventPublisher stubs ready to connect to n8n workflows

- **Docs**
  - Case study
  - Rules/engine explanation
  - API reference
  - Frontend walkthrough
  - Configuration

This is the “Phase 0” functional baseline.

---

## 1. OCR & Document Understanding (Phase 1)

### 1.1 Pluggable OCR Providers

Goal: swap the stub pipeline for real OCR while keeping tests deterministic.

Steps:

1. Introduce a provider enum / factory for OCR:
   - `local_tesseract`
   - `cloud_vision`
   - `gpt_4o_vision` / `gemini_vision`
2. Keep `BaseOcrPipeline` as the primary interface.
3. Implement:
   - `TesseractOcrPipeline` (local dev)
   - `LlmVisionOcrPipeline` (OpenAI / Google)
4. Add configuration:
   - `AUTOCOMPLY_OCR_PROVIDER`
   - Related API keys/scopes.

### 1.2 Normalization Layer

Goal: normalize noisy OCR into stable fields.

- Create a `normalize_ocr_fields(raw_ocr_output)` function:
  - Extract and normalize:
    - License ID
    - State
    - Expiry date
    - Practitioner / organization name
  - Handle common OCR artifacts:
    - Hyphenation, extra spaces, broken dates.

- Extend tests with:
  - Synthetic “noisy” OCR outputs.
  - Expected normalized fields.

---

## 2. Regulatory RAG (Phase 2)

### 2.1 Real Knowledge Store

Goal: move from in-memory snippets to a small but realistic RAG store.

Steps:

1. Collect a curated set of public documents (or excerpts), such as:
   - DEA: Controlled Substances Act excerpts
   - Selected state boards of pharmacy rules (e.g. CA, NY, TX)
   - Ryan Haight Act summaries

2. Build a RAG pipeline (local first):
   - Simple embeddings store using Chroma (local filesystem) or similar.
   - Chunking with `langchain-text-splitters` (already in `requirements.txt`).
   - `RegulatoryRagRetriever` interface.

3. Keep `RegulationRetriever` as a high-level abstraction:
   - Decide internally whether to:
     - Use the stub in-memory knowledge base, or
     - Call the RAG pipeline.

### 2.2 Structured Regulatory Context

Goal: make RAG output predictable and safe.

- Define a structured output schema for context items:
  - `id`, `jurisdiction`, `topic`, `text`, `source`, `confidence`.
- Use LLMs to “compress + ground” retrieved chunks into:
  - One or two clear, short explanations per decision.
- Add tests around:
  - Presence of `regulatory_context` for key scenarios.
  - Reasonable caps on number/length of snippets.

---

## 3. Attestation & Controlled Forms (Phase 3)

Goal: extend the engine to not just say “allow/deny”, but also
**“allow if these attestations are completed”**.

### 3.1 Attestation Engine

- Introduce an `AttestationRequirement` model:
  - `id`, `jurisdiction`, `scenario`, `text`, `must_acknowledge`.

- Extend `ComplianceEngine` to:
  - Detect scenarios requiring an attestation (e.g. telemedicine, specific states).
  - Attach required attestations to the verdict:
    - `verdict.attestations_required[]`.

### 3.2 Frontend Integration

- Extend `ComplianceCard` to:
  - Show “Attestations required” when present.
  - Provide a CTA to open an attestation modal.

- Create a new endpoint (future):
  - `POST /api/v1/licenses/attest`
    - Accepts attestation payload.
    - Returns updated verdict / audit log entry.

---

## 4. n8n & Automation (Phase 4)

Goal: turn decisions into **real workflows** (still safely demoable).

### 4.1 Webhook Contracts

Define stable webhook payloads for:

- License validation events
  - `event=license_validation`
  - `license_id`, `state`, `allow_checkout`, `status`, `days_to_expiry`
- Attestation completion
  - `event=attestation_completed`, `attestation_id`, `license_id`
- Upcoming expiries
  - `event=license_near_expiry`

Use `EventPublisher.build_license_event(...)` as the contract.

### 4.2 n8n Workflows

Implement n8n workflows (JSON in `n8n/workflows`):

- `email_intake.json`
  - Email → attachment → `/validate-pdf` → Slack + Airtable.

- `slack_alerts.json`
  - Webhook → Slack channel with formatted message.

- `renewal_reminders.json`
  - Scheduled job → soon-expiring licenses → email/SMS.

The backend remains:

- Responsible for decisions.
- Stateless about workflow timing.

n8n handles:

- Scheduling.
- Multi-channel notifications.
- Simple UI automation.

---

## 5. LangChain / LangGraph Integration (Phase 5)

Goal: evolve the internal flow into an **agentic, step-wise graph**.

### 5.1 Internal Graph Model

Map the current flow:

1. Input (JSON or PDF).
2. OCR (if PDF).
3. Field normalization.
4. Regulatory retrieval (stub / RAG).
5. Decision engine (expiry + rules).
6. Attestation requirements.
7. Event publishing.

Implement as a small internal graph:

- Use LangChain / LangGraph primitives for:
  - Nodes: OCR, Normalize, RAG, Decision, Attestation.
  - Edges: data passing between nodes.

Maintain:

- The existing FastAPI endpoints as entry points.
- The same response shapes for verdicts.

### 5.2 Observability & Traces

- Add optional tracing:
  - Correlation ID per request.
  - Node-level timing and status.
- Expose a debug endpoint:
  - `GET /api/v1/licenses/debug/<trace_id>`
  - Returns the decision path (for developer demos).

---

## 6. Hardening & Production-Readiness (Phase 6)

Goal: show a plausible path to production.

- Add stricter validation:
  - More granular error messages on bad inputs.
  - Clear distinction between 4xx (client) and 5xx (server) errors.

- Security considerations:
  - No PII logged.
  - Config-driven toggles for:
    - Detailed logs vs anonymized logs.
    - Demo vs production modes.

- Rate limiting (optional future):
  - Simple middleware for per-IP rate limits.

- Performance:
  - Basic load tests (e.g., Locust or similar).
  - Benchmarks for:
    - JSON-only flows.
    - PDF + OCR flows.
    - RAG-augmented decisions.

---

## 7. Portfolio & Demo Positioning

For conversations and demos, the roadmap shows:

- You already built the “Phase 0–1” components and tests.
- You have a clear, realistic path to:
  - Real OCR
  - Real regulatory RAG
  - Attestation flows
  - Automation with n8n
  - Agentic orchestration with LangGraph

This makes AutoComply AI credible as:

> “A GenAI-ready compliance engine modeled on real enterprise work, with
> a concrete path to production.”
