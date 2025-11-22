# AutoComply AI

AutoComply AI is a modular compliance engine that simulates how a real e-commerce platform would validate licenses and controlled-substance eligibility at checkout.

It combines:

- A deterministic rules engine (expiry windows, state checks, purchase intent)
- PDF/OCR stubs to extract basic signals from uploaded license documents
- A RAG-style regulatory context layer, wired for LangChain-style evolution
- A clean React frontend that feels like a “compliance cockpit”
- Optional event publishing hooks for n8n / workflow automation

> **Interview framing:**  
> This repo shows how you would take a fuzzy, high-risk business problem (“are we allowed to ship this controlled product to this customer?”) and turn it into a deterministic, testable decision service with explainability.

---

## High-level architecture

**Backend (FastAPI, Python)** – `/backend`

- `src/api/main.py`  
  - Wires up versioned routes under `/api/v1/licenses/...`
  - Central FastAPI app used by both tests and frontend
- `src/api/routes/license_validation.py`  
  - JSON/manual endpoint: `/api/v1/licenses/validate/license`
  - PDF endpoint: `/api/v1/license/validate-pdf`
  - RAG “rule explanation” endpoint: `/api/v1/licenses/explain-rule`
- `src/compliance/decision_engine.py`  
  - Encapsulates the core decisioning and expiry rules
- `src/compliance/license_validator.py`  
  - Specialised helpers to interpret expiry windows, “near expiry” logic, etc.
- `src/rag/*`  
  - `loader.py`, `embedder.py`, `retriever.py` – minimal RAG-style pipeline, currently using in-memory/demo data but structured to be swapped to LangChain/LangGraph later
- `src/ocr/*`  
  - `preprocess.py`, `extract.py` – stub OCR pipeline for PDFs
- `src/utils/logger.py`  
  - Centralised JSON logger for structured logs
- `src/utils/events.py`
  - EventPublisher stub wired from the API (for n8n / Slack etc. later)

**Frontend (React + Vite + Tailwind)** – `/frontend`

- `src/pages/Home.jsx`  
  - Main experience: upload PDF or enter license details manually
- `src/components/UploadBox.jsx`  
  - File upload box for PDF license docs
- `src/components/ComplianceCard.jsx`  
  - Shows engine verdict (allow/deny), expiry status, regulatory context, attestations, and a soft-gated “Proceed to checkout” button
  - “Why this decision?” button calls the `/explain-rule` endpoint and renders an explanation block
- `src/services/api.js`  
  - Tiny API client: `validateLicenseJson`, `uploadPdf`, `explainRule`, etc.

**Automation / workflows**

- `n8n/workflows/*.json`  
  - Placeholders showing how events from `EventPublisher` could be consumed by n8n flows (Slack alerts, renewal reminders, etc.)

---

## Key backend flows

### 1. Manual license validation (JSON flow)

Endpoint: `POST /api/v1/licenses/validate/license`

1. Frontend sends a JSON payload (state, state_expiry, purchase_intent, quantity, etc.).
2. API builds a `LicenseValidationRequest` and calls `ComplianceEngine.evaluate()`.
3. Decision engine returns a `LicenseValidationVerdict`:
   - `allow_checkout` (boolean)
   - `status` (`"active"`, `"near_expiry"`, `"expired"`, etc.)
   - `days_to_expiry`, `is_expired`
   - Attestation requirements (if any)
4. RAG pipeline is invoked to attach a `regulatory_context` list:
   - Jurisdictions like `US-CA`, `US-DEA`
   - Short snippets explaining what was considered
5. API wraps this in `{ success: true, verdict: {...} }` and returns to the frontend.
6. In parallel, an event is emitted via `EventPublisher` (stubbed) for downstream workflows.

### 2. PDF license validation (OCR + rules)

Endpoint: `POST /api/v1/license/validate-pdf`

1. User uploads a PDF (e.g., state license document).
2. `extract_text_from_pdf` (stub) returns raw text; we expose a safe `text_preview` and basic metadata.
3. Backend builds a default `LicenseValidationRequest` (today + 1 year, CA, etc.) as a demo.
4. Same decision engine + RAG pipeline are executed.
5. Response includes:
   - `verdict`: full decision object
   - `extracted_fields`: PDF file name, preview, character counts

### 3. “Why this decision?” explanation

Endpoint: `POST /api/v1/licenses/explain-rule`

1. Frontend sends a minimal payload: `{ "state": "CA", "purchase_intent": "GeneralMedicalUse" }`.
2. RAG layer returns one or more context items:
   - `jurisdiction` (e.g., `US-CA`)
   - `source` (e.g., “Use-case context (demo)”)
   - `snippet` – human-readable explanation
3. Frontend renders this under the verdict to make the decision explainable, not a black box.

---

## Frontend experience

- **Upload license PDF** or **enter details manually**.
- See:
  - Allow / Block outcome
  - Expiry label and days to expiry
  - Regulatory context chips
  - Attestation chips with a checkbox and soft-gated “Proceed to checkout” button
- Click **“Why this decision?”** to fetch RAG-based explanation text.

---

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Run FastAPI app
uvicorn src.api.main:app --reload --port 8000

Frontend
cd frontend
npm install
npm run dev


By default, the frontend expects VITE_API_BASE to point to the backend:

# Example: in a .env file in /frontend
VITE_API_BASE=http://localhost:8000

Tests & CI

Test suite lives under /backend/tests.

GitHub Actions pipeline:

Installs backend dependencies

Runs pytest

(Optionally) builds Docker images / deploys if secrets are configured

Run tests locally:

cd backend
pytest

Future evolution (LangChain / LangGraph ready)

The RAG layer is intentionally small and modular:

loader.py – where documents are loaded from (files, API, DB…)

embedder.py – embedding strategy (currently stubbed to keep infra light)

retriever.py – how we select relevant context for a given state + scenario

You can swap these into a LangChain or LangGraph pipeline with minimal refactoring:
the API surface already treats it as a pluggable provider.

How to talk about this in interviews

Business story:
Controlled-substance checkout is high-risk and requires license validation, expiry checks, and jurisdictional logic across states + DEA. AutoComply AI simulates that decision engine in a clean, testable way.

Tech story:
FastAPI backend, modular rules engine, OCR stub, and RAG explanation layer, all wrapped with tests and CI. React frontend gives a realistic UX so stakeholders can “feel” how compliance behaves before productionizing.

AI story:
RAG isn’t making the final decision, it’s explaining it. The actual allow/deny is deterministic; AI/RAG is used to generate human-readable context and “why” text, which is a safer and more auditable pattern for compliance.


---
