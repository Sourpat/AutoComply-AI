# AutoComply AI – Architecture Overview

This document drills deeper into the architecture so an engineer or interviewer can understand how the pieces fit together.

---

## 1. Component map

**Backend (FastAPI, Python)**

- `src/api/main.py`
  - Defines the FastAPI app and mounts all versioned routes.
  - Applies CORS and any future middleware.
- `src/api/routes/license_validation.py`
  - JSON/manual license validation endpoint
  - PDF validation endpoint (OCR stub)
  - RAG explain-rule endpoint
- `src/compliance/decision_engine.py`
  - The core “brain” of the rules engine.
  - Consumes `LicenseValidationRequest` and returns `LicenseValidationVerdict`.
- `src/compliance/license_validator.py`
  - Handles date math, expiry windows, and edge cases.
- `src/rag/*`
  - Encapsulates the regulatory context retrieval pipeline.
- `src/ocr/*`
  - Encapsulates the PDF → text pipeline (currently stubbed).
- `src/utils/*`
  - Logging, events and shared utilities.

**Frontend (React + Vite)**

- `Home.jsx` – orchestrates the two flows:
  - Manual entry JSON form
  - PDF upload + OCR stub
- `ComplianceCard.jsx` – presents the final decision, context, and attestations.
- `UploadBox.jsx` – handles the file selection UX.
- `api.js` – thin wrapper over backend endpoints.

**Automation**

- `n8n/workflows/*.json` – placeholder definitions for future n8n flows:
  - Slack alerts for blocked/near-expiry decisions
  - License renewal reminders
  - Audit logging to an external system

---

## 2. Request lifecycle (manual JSON flow)

1. **User action**  
   User fills the manual form (state, permit, expiry, quantity, purchase intent) and clicks **Validate License**.

2. **Frontend → Backend**  
   `Home.jsx` calls `validateLicenseJson(payload)` in `api.js`, which POSTs to `/api/v1/licenses/validate/license`.

3. **API layer**  
   The route:
   - Validates the payload against `LicenseValidationRequest`.
   - Instantiates `ComplianceEngine`.
   - Calls `engine.evaluate(payload)`.

4. **Decision engine**  
   The engine:
   - Normalizes input (dates, enums, etc.).
   - Applies expiry logic (expired, near expiry, active).
   - Determines `allow_checkout` vs `blocked`.
   - Optionally adds attestation requirements (e.g., telemedicine, storage).

5. **RAG context**  
   The API calls into the RAG pipeline to build `regulatory_context`:
   - Looks at `state` + `purchase_intent`.
   - Fetches one or more context snippets that explain why this decision is sensitive.
   - Examples: `US-CA` state-level explanation, `US-DEA` controlled substance context.

6. **Event publishing**  
   Before returning, the route creates an event payload and passes it to `EventPublisher`:
   - Intended for non-blocking downstream flows (Slack alerts, audit logs, etc.).
   - Tests use a stub to avoid network calls.

7. **Response to frontend**  
   The combined response looks like:

   ```json
   {
     "success": true,
     "verdict": {
       "allow_checkout": true,
       "status": "near_expiry",
       "days_to_expiry": 7,
       "state": "CA",
       "license_id": "ABC123",
       "regulatory_context": [
         {
           "jurisdiction": "US-CA",
           "source": "Use-case context (demo)",
           "snippet": "This decision considers CA state licensing and ship-to alignment..."
         }
       ],
       "attestations_required": [
         {
           "id": "storage-conditions",
           "jurisdiction": "US-DEA",
           "scenario": "Controlled storage",
           "text": "I confirm the practice maintains DEA-compliant storage...",
           "must_acknowledge": true
         }
       ]
     }
   }


Frontend rendering
ComplianceCard.jsx renders the status, attestation chips, and regulatory context, plus a soft-gated “Proceed to checkout” button.

3. RAG pipeline (demo mode)

The code is structured like a real RAG system, but with demo-friendly storage:

loader.py

Today: returns in-memory documents for a few jurisdictions/intents.

Future: plug in a document store or vector DB.

embedder.py

Today: stubbed to avoid infra overhead.

Future: wrap an OpenAI / Azure OpenAI / other embedding model.

retriever.py

Today: selects relevant context from demo docs based on state + purchase_intent.

Future: swap to a true vector search or LangChain retriever.

The goal is to make RAG optional and explainable:

The deterministic decision is always driven by the rules engine.

RAG provides human-readable explanations and context, not the final verdict.

4. OCR / PDF flow

/api/v1/license/validate-pdf receives an UploadFile.

Content-type and non-empty guards are applied.

extract_text_from_pdf(bytes) returns raw text or an error string.

A safe default LicenseValidationRequest is constructed (demo-only).

The same engine + RAG pipeline are called.

Response includes an extracted_fields block for the UI.

5. Events & n8n

EventPublisher defines a simple interface for pushing events such as:

license_validation with state, license_id, allow_checkout, etc.

In this demo:

The publisher is a stub to keep tests deterministic.

n8n workflows are represented as JSON placeholders only.

In a real deployment, EventPublisher could:

POST to an n8n webhook

Publish to Kafka / a message bus

Send Slack or email alerts

6. Extensibility

New jurisdictions and rules:

Add to the rules configuration (e.g., YAML/JSON sources).

Expand the RAG documents with jurisdiction-specific snippets.

New purchase intents:

Add new enum cases and logic in the decision engine.

Deeper RAG:

Swap embedder and retriever to a proper LangChain/LangGraph pipeline.

Stronger OCR:

Replace the stub with a real OCR service and mapping from PDF → structured fields.


---
