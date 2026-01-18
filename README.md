# AutoComply AI

> A regulatory copilot playground for controlled substances and drug distribution flows.  
> Built with FastAPI + React, RAG, multi-agent architecture, and DevSupport tooling.

**🚀 Live Demo**: [autocomply-ai.vercel.app](https://autocomply-ai.vercel.app)  
**📘 Deployment Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)  
**⚙️ Backend**: Hosted on Render at `https://autocomply-ai.onrender.com` (TODO: Update once deployed)

> **Note**: Frontend on Vercel connects to public Render backend. Localhost URLs will NOT work for deployed frontends.

## Quick Start

### Development

**Frontend:**
```bash
cd frontend
npm install
npm run dev          # Start dev server on http://localhost:5173
```

**Backend:**
```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### Production

**Frontend:**
```bash
cd frontend
npm run build        # Build static files to dist/
npm run preview      # Preview build locally
npm run preview:host # Preview on network (0.0.0.0)
```

**Backend:**
```bash
cd backend
# Configure .env with production settings (see docs/DEPLOYMENT.md)
chmod +x start.sh
./start.sh           # Production start script (sets APP_ENV=prod)
```

Or with uvicorn directly:
```bash
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --workers 4
```

### Hosted Deployment

Deploy to Heroku, Railway, Render, Vercel, or other platforms:

**Backend (Heroku/Railway/Render):**
- Start Command: `cd backend && ./start.sh`
- Environment: Set `CORS_ORIGINS`, `AUTOCOMPLY_OPENAI_KEY`, etc.
- See [`Procfile.example`](Procfile.example) for reference

**Frontend (Vercel/Netlify/Cloudflare Pages):**
- Build Command: `cd frontend && npm ci && npm run build`
- Publish Directory: `frontend/dist`
- Environment: Set `VITE_API_BASE_URL`, `VITE_APP_ENV=prod`

For platform-specific instructions, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`HOSTED_DEPLOYMENT_ENTRY_POINTS.md`](HOSTED_DEPLOYMENT_ENTRY_POINTS.md).

### Docker (Easiest for Production)

```bash
docker-compose up -d
# Backend: http://localhost:8001
# Frontend: http://localhost:80
# n8n: http://localhost:5678
```

For detailed deployment instructions, see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Overview

AutoComply AI simulates a realistic compliance environment where:

- Deterministic engines (CSF + Ohio TDDD) make **hard regulatory decisions**,
- A **RAG pipeline** explains those decisions using real documents (PDF/HTML) under `/mnt/data/...`,
- A **multi-agent** layer (DevSupport / Regulatory Explainer / Form Copilot) can sit on top,
- A React frontend exposes **sandbox UIs** for demos and interviews,
- **DevSupport affordances** (CODEX logs, DevSupport console, copy-cURL, health chip) make debugging and orchestration easy.
- **Controlled Substance Forms (CSF) Suite** – multi-tenant sandboxes + RAG explanations for Hospital, Practitioner, Facility, EMS, and Researcher CSFs. See [`docs/csf_suite_overview.md`](docs/csf_suite_overview.md) for details.
- **License Compliance Suite** – license evaluation + RAG-based explanations, starting with Ohio TDDD. See [`docs/license_suite_overview.md`](docs/license_suite_overview.md) for details.
- **End-to-End Compliance Journey** – how CSF decisions and Ohio TDDD license checks work together, with explainable RAG copilots. See [`docs/compliance_journey_csf_license.md`](docs/compliance_journey_csf_license.md).

## How this maps to an AI PM lifecycle

AutoComply AI is intentionally structured around an AI-enabled product
lifecycle:

- **Discover:** Real Ohio hospital & NY pharmacy scenarios and presets expose
  true controlled substance edge cases (missing DEA, wrong state, expired licenses).
- **Research:** A regulatory RAG layer and knowledge APIs back every decision
  with explainable context and sources.
- **Design:** A dark-mode Compliance Console with scenario presets, RAG debug
  toggles, and per-trace case summaries keeps the UX simple while surfacing
  rich explanations.
- **Build:** FastAPI decision engines, canonical decision schemas, and a broad
  pytest suite implement the core compliance brain.
- **Launch:** Demo scripts, health checks, and copy-as-cURL affordances make
  the system easy to show and to integrate with CI/n8n/Postman.
- **Measure & Iterate:** Trace-aware case summaries, tenant-aware ops, and
  recent decision feeds provide observability and drive new scenario tests.

For a deeper breakdown, see
[`backend/docs/ai_pm_lifecycle_mapping.md`](backend/docs/ai_pm_lifecycle_mapping.md).

## Canonical case summary contract

AutoComply AI exposes a canonical JSON contract for each decision trace:

```http
GET /cases/summary/{trace_id}
```

This endpoint aggregates:

- CSF decisions (hospital, facility, practitioner, EMS, etc.)
- License decisions (Ohio TDDD, NY Pharmacy, and future engines)
- Order decisions (mock approvals today, production flows later)
- Regulatory references and RAG sources
- Debug and audit metadata packaged as a per-trace insight object

Downstream systems (checkout flows, n8n workflows, audit tools, agents) can
consume this single contract instead of calling each engine directly.

For a detailed field-by-field breakdown, see
[`backend/docs/case_summary_json_contract.md`](backend/docs/case_summary_json_contract.md).

### Risk and explanation semantics

AutoComply AI normalizes decisions across CSF, licenses, and orders using:

- A common status vocabulary: `ok_to_ship`, `needs_review`, `blocked`
- Derived risk levels (low / medium / high) used in dashboards
- A short, analyst-style explanation text built from jurisdiction and
  regulatory sources

For details on how status maps to risk and how explanation text is built,
see [`backend/docs/risk_and_explanation_semantics.md`](backend/docs/risk_and_explanation_semantics.md).

### Example vertical: NY Pharmacy

AutoComply AI is structured so specific regulatory domains can be modeled as
**verticals** on top of the same decision and RAG foundation.

The NY Pharmacy license flow is one such vertical:

- Backend:
  - `POST /license/ny-pharmacy/evaluate`
  - Scenario tests for happy path, expired license, and wrong state
- Frontend:
  - A dedicated NY Pharmacy license sandbox in the Compliance Console

See [`backend/docs/vertical_ny_pharmacy.md`](backend/docs/vertical_ny_pharmacy.md)
for a detailed walkthrough of the NY Pharmacy vertical.

## Vertical demos

AutoComply AI ships with demo-ready compliance verticals that sit on top
of the shared decision core and RAG layer.

Current verticals:

- NY Pharmacy vertical
- Ohio Hospital vertical

For how to run these from the Compliance Console, see:

- `backend/docs/verticals/vertical_demos_overview.md`
- `backend/docs/verticals/ny_pharmacy_vertical.md`
- `backend/docs/verticals/ohio_hospital_vertical.md`

## Compliance Console Overview

The AutoComply AI **Compliance Console** is a developer-friendly “compliance lab” that sits on top of the core engines:

- Controlled substance form (CSF) engines  
- License engines (Ohio TDDD, NY pharmacy)  
- Mock order engines that combine CSF + license outcomes  
- Health & testing signals from the backend  

It is built with **FastAPI** (backend) and **Vite + React + TypeScript** (frontend), and is designed to show how a regulated e-commerce platform can expose internal decision engines in a way that:

- Business users can **experiment with scenarios**
- Engineers can **inspect payloads and responses**
- Everyone can see **which pytest files** back a given UI flow
- External tools (Postman, other apps) can call the same endpoints via **“Copy as cURL”**

For a step-by-step walkthrough you can use in demos or interviews, see
`docs/demo_script_compliance_console.md`.

For a high-level roadmap of how this lab could evolve into a broader
compliance platform, see `docs/roadmap_autocomply_ai.md`.

### What you can do in the console

**1. Controlled Substance Form (CSF) sandboxes**

The console exposes three CSF engines:

- **Hospital CSF sandbox** – `POST /csf/hospital/evaluate`  
- **Facility CSF sandbox** – `POST /csf/facility/evaluate`  
- **Practitioner CSF sandbox** – `POST /csf/practitioner/evaluate`  

Each sandbox lets you:

- Fill out a realistic CSF form (hospital, facility, or prescriber)  
- Click **Evaluate** to run the decision engine  
- Use **Form Copilot** to get an explanation + missing fields  
- See a **DecisionStatusBadge** (ok_to_ship / needs_review / blocked)  
- Click **“Copy as cURL”** to grab a ready-to-run request for the current form  
- View a **TestCoverageNote** that points at the relevant pytest file (for example `backend/tests/test_csf_hospital_api.py`)  

Behind the scenes, these sandboxes are wired to FastAPI routers and a RAG/regulations layer that can be extended with new DEA/state rules.

**2. License engine sandboxes**

The **License engines** section exposes two license evaluators that are reused by the mock order journeys:

- **Ohio TDDD license sandbox** – `POST /license/ohio-tddd/evaluate`  
- **NY pharmacy license sandbox** – `POST /license/ny-pharmacy/evaluate`  

For each license engine you can:

- Enter license number, DEA number, facility/pharmacy name, and ship-to state  
- Run **Evaluate license** to see how the engine classifies the scenario  
- Inspect a **developer trace** (raw JSON request + response)  
- Click **“Copy … cURL”** to replay the call from a terminal or Postman  
- See a **TestCoverageNote** pointing at the license pytest file (for example `backend/tests/test_license_ohio_tddd_api.py` and `backend/tests/test_license_ny_pharmacy_api.py`)  

**3. Mock order journeys**

The console also includes end-to-end mock orders that combine CSF + license engines into a single decision:

- **Ohio hospital mock order** – `POST /orders/mock/ohio-hospital-approval`  
- **Ohio facility mock order** – `POST /orders/mock/ohio-facility-approval`  
- **NY pharmacy mock order** – `POST /orders/mock/ny-pharmacy-approval`  

Each mock order panel shows:

- Inputs from upstream engines (e.g., Hospital/Facility CSF + Ohio TDDD license)  
- The final mock order decision with a status badge and human-readable explanation  
- A **developer trace** panel with the combined payload and response  
- A **“Copy mock order cURL”** button and a note that links back to the **API reference** card  

This makes it very clear how a real e-commerce order would “see” the internal compliance engines.

**4. Health, testing & API reference**

The console also surfaces platform-level signals:

- **System health card**  
  - Calls `/health` and `/health/full` and shows component-level status (CSF, license, mock orders).  
  - A **TestCoverageNote** points to `backend/tests/test_health_api.py`.  

- **Testing & reliability card**  
  - Summarizes pytest coverage for CSF, license, health, and mock order APIs.  
  - Shows a consolidated **TestCoverageNote** listing key test files such as:  
    - `backend/tests/test_csf_hospital_api.py`  
    - `backend/tests/test_csf_facility_api.py`  
    - `backend/tests/test_csf_practitioner_api.py`  
    - `backend/tests/test_license_ohio_tddd_api.py`  
    - `backend/tests/test_license_ny_pharmacy_api.py`  
    - `backend/tests/test_order_mock_approval_api.py`  
    - `backend/tests/test_order_mock_ny_pharmacy_api.py`  

- **API reference card**  
  - Lists the main backend endpoints grouped by category (CSF, Licenses, Mock orders).  
  - Each mock order trace panel in the UI explicitly points back to the relevant row in this API reference, closing the loop between UI and HTTP APIs.

---

### How this helps demonstrate product + engineering thinking

This project is intentionally structured to show more than just “I can call an API”:

- **Product thinking** – The console is organized the way a real compliance stakeholder would explore the system: start with CSF and license decisions, then look at end-to-end mock orders, then inspect health and test coverage.  
- **Engineering discipline** – Nearly every sandbox advertises its backing pytest files via `TestCoverageNote`, and smoke tests/health checks are wired into CI.  
- **Developer experience (DX)** – “Copy as cURL”, developer traces, and an API reference card make it trivially easy for other tools (Postman, other services, agents) to reuse the same engines.  
- **Regulated e-commerce context** – The flows are modeled on real-world controlled substance and license checks (e.g., DEA, Ohio TDDD, NY pharmacy), but implemented in a way that is safe to demo and extend.

### Quick demo script (3–5 minutes)

If you are using this project in interviews or portfolio reviews, a simple demo flow is:

1. **Start with CSF sandboxes**  
   - Open the Compliance Console and show Hospital / Facility / Practitioner CSF cards.  
   - Run an evaluation, show the status badge and Form Copilot explanation.  
   - Highlight the `TestCoverageNote` and mention the corresponding pytest file.

2. **Jump to License engines**  
   - Open the Ohio TDDD and NY pharmacy license sandboxes.  
   - Change license values and re-evaluate to show how outputs change.  
   - Use “Copy … cURL” to prove that this is just HTTP under the hood.

3. **Show a mock order journey**  
   - Navigate to an Ohio or NY mock order card.  
   - Run a mock order and show the final decision + developer trace JSON.  
   - Point at the API reference card row that matches the endpoint.  

4. **Close with health & testing**  
   - Show the System health and Testing & reliability cards.  
   - Call out that health endpoints and engines are backed by pytest and surfaced directly in the UI.

---

### AI / RAG and explainability

AutoComply AI is not just a set of hard-coded rules. The console surfaces an **explainable AI / RAG layer** that sits on top of the controlled substance and license decision engines.

#### CSF Form Copilot (Hospital, Facility, Practitioner)

Each CSF sandbox has a **Form Copilot** that uses the backend AI layer to:

- Highlight **missing or unclear fields** in the form.  
- Call out **regulatory references** (for example, internal rule slugs or document labels).  
- Provide a **natural language explanation** of why the CSF is ok_to_ship / needs_review / blocked.  
- Optionally list **sources / artifacts** consulted by the RAG pipeline.

In the UI, this is rendered via a shared **RegulatoryInsightsPanel** that appears under the Form Copilot result for:

- Hospital CSF sandbox  
- Facility CSF sandbox  
- Practitioner CSF sandbox  

When the backend returns richer regulatory metadata (missing fields, references, sources), the panel lights up with:

- A short decision label  
- A “Missing or unclear fields” list  
- A “Regulatory references” chip list  
- A “How the RAG layer interpreted this form” explanation block  
- Optional “Sources consulted” items

#### License engines + regulatory insights

The **License engines** section (Ohio TDDD + NY pharmacy) also supports a lighter version of these insights:

- The main card shows the license decision and explanation.  
- If the license engine returns regulatory metadata (e.g., `regulatory_references`, `rag_explanation`, `rag_sources`), a **RegulatoryInsightsPanel** appears under the decision.  
- This keeps the UI clean today, but is ready for more AI-driven explanations as the backend evolves.

#### AI / RAG debug mode

The **AI / RAG debug** toggle in the top-right of the Compliance Console makes it easy to switch between:

- **Normal mode** – clean, product-facing experience (ideal for demos with business stakeholders or recruiters).  
- **Debug mode** – deeper visibility for engineers and AI/ML folks.

When debug is enabled:

- CSF sandboxes show a **“RAG debug” JSON block** with the raw Form Copilot payload under the Regulatory Insights panel.  
- License sandboxes show **developer trace JSON** for each evaluation (request + response), gated behind the same toggle.  

This lets you:

- Walk through a clean, explainable flow in normal mode.
- Flip one switch and immediately inspect the underlying objects being returned by the AI/RAG layer and decision engines.

For an example of how to orchestrate these endpoints from n8n or similar tools, see `docs/integrations_n8n_example.md`.

#### How to talk about this in interviews

A simple way to describe the AI / RAG layer in this project:

- **“I designed a Compliance Console that not only runs CSF and license decision engines, but also exposes an explainable AI/RAG layer for those decisions.”**  
- **“Form Copilot and Regulatory Insights panels show missing fields, regulatory references, and natural language explanations, instead of just status codes.”**  
- **“There is a global AI / RAG debug toggle that switches the console between a clean stakeholder view and a deep engineer/ML debug mode, without changing the code.”**  
- **“The same endpoints are consumable from external tools via Copy-as-cURL, and most sandboxes advertise their backing pytest coverage via TestCoverageNote.”**

---

## Quickstart – Ohio Hospital Order Demo

This project ships with a concrete, end-to-end scenario that shows how the platform combines:

- **CSF Suite** – evaluates a Hospital Controlled Substance Form (CSF).
- **License Suite** – validates an Ohio TDDD (Terminal Distributor of Dangerous Drugs) license.
- **Mock Order Engine** – produces a single order-level decision.

The scenario is:

> Ohio hospital ordering a **Schedule II** controlled substance, shipped to **Ohio (OH)**.

### Happy Path – CSF OK, Ohio TDDD OK → Order OK to Ship

With the backend running locally (e.g. on `http://localhost:8000`), you can run:

```bash
curl -X POST http://localhost:8000/orders/mock/ohio-hospital-approval \
  -H "Content-Type: application/json" \
  -d '{
    "hospital_csf": {
      "hospital_name": "Ohio General Hospital",
      "facility_type": "hospital",
      "account_number": "800123456",
      "ship_to_state": "OH",
      "dea_number": "AB1234567",
      "pharmacist_in_charge_name": "Dr. Jane Doe",
      "pharmacist_contact_phone": "555-123-4567",
      "attestation_accepted": true,
      "internal_notes": "Mock order test – Ohio hospital Schedule II.",
      "controlled_substances": [
        {
          "drug_name": "Oxycodone 10mg",
          "schedule": "II",
          "quantity": 100
        }
      ]
    },
    "ohio_tddd": {
      "tddd_number": "01234567",
      "facility_name": "Ohio General Hospital",
      "account_number": "800123456",
      "ship_to_state": "OH",
      "license_type": "ohio_tddd",
      "attestation_accepted": true,
      "internal_notes": "Valid Ohio TDDD license for mock order test."
    }
  }'
```

You should see a response shaped like:

```
{
  "csf_status": "ok_to_ship",
  "csf_reason": "...",
  "csf_missing_fields": [],
  "tddd_status": "ok_to_ship",
  "tddd_reason": "...",
  "tddd_missing_fields": [],
  "final_decision": "ok_to_ship",
  "notes": [
    "Hospital CSF decision: ok_to_ship – ...",
    "Ohio TDDD decision: ok_to_ship – ...",
    "Final mock order decision: ok_to_ship"
  ]
}
```

The exact wording will vary, but the key part is:

- `csf_status = "ok_to_ship"`
- `tddd_status = "ok_to_ship"`
- `final_decision = "ok_to_ship"`

### Negative Path – CSF OK, Ohio TDDD Missing → Order NOT OK to Ship

You can flip just the license part to simulate missing TDDD info:

```bash
curl -X POST http://localhost:8000/orders/mock/ohio-hospital-approval \
  -H "Content-Type: application/json" \
  -d '{
    "hospital_csf": {
      "hospital_name": "Ohio General Hospital",
      "facility_type": "hospital",
      "account_number": "800123456",
      "ship_to_state": "OH",
      "dea_number": "AB1234567",
      "pharmacist_in_charge_name": "Dr. Jane Doe",
      "pharmacist_contact_phone": "555-123-4567",
      "attestation_accepted": true,
      "internal_notes": "Negative mock order test – missing TDDD number.",
      "controlled_substances": [
        {
          "drug_name": "Oxycodone 10mg",
          "schedule": "II",
          "quantity": 100
        }
      ]
    },
    "ohio_tddd": {
      "tddd_number": "",
      "facility_name": "Ohio General Hospital",
      "account_number": "800123456",
      "ship_to_state": "OH",
      "license_type": "ohio_tddd",
      "attestation_accepted": true,
      "internal_notes": "Missing TDDD number for negative mock order test."
    }
  }'
```

In this case, you should see something like:

```
{
  "csf_status": "ok_to_ship",
  "tddd_status": "needs_review", // or "blocked", depending on rules
  "final_decision": "needs_review", // or "blocked"
  "notes": [
    "Hospital CSF decision: ok_to_ship – ...",
    "Ohio TDDD decision: needs_review – Missing required fields: tddd_number",
    "Final mock order decision: needs_review"
  ]
}
```

The engine is allowed to choose between needs_review and blocked, but the important thing is:

- `csf_status = "ok_to_ship"`
- `tddd_status != "ok_to_ship"`
- `final_decision != "ok_to_ship"`

### Learn More

- Architecture for the CSF Suite: [`docs/csf_suite_overview.md`](docs/csf_suite_overview.md)
- Architecture for the License Suite: [`docs/license_suite_overview.md`](docs/license_suite_overview.md)
- Combined CSF + Ohio TDDD journey: [`docs/compliance_journey_csf_license.md`](docs/compliance_journey_csf_license.md)
- Case study walkthrough: [`docs/portfolio_case_study_autocomply_ai.md`](docs/portfolio_case_study_autocomply_ai.md)
- Scenario tests that back this Quickstart:
  - `tests/test_scenario_ohio_hospital_schedule_ii.py`
  - `tests/test_order_mock_approval_api.py`

---

## 🔍 What this project demonstrates

**Regulatory engines**

- CSF decision engines:
  - Practitioner
  - Hospital Pharmacy
  - Researcher
  - Surgery Center
  - EMS
- Ohio TDDD decision engine:
  - Eligibility & explanation for Ohio drug distribution rules

**RAG over real documents**

All regulatory context is grounded in real documents mounted under `/mnt/data/...`, for example:

- `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`
- `/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf`
- `/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf`
- `/mnt/data/Online Controlled Substance Form - Researcher form.pdf`
- `/mnt/data/Online Controlled Substance Form - EMS form.pdf`
- `/mnt/data/FLORIDA TEST.pdf`
- `/mnt/data/addendums.pdf`
- `/mnt/data/Ohio TDDD.html`
- `/mnt/data/Controlledsubstance_userflow.png`
- `/mnt/data/Controlled_Substances_Form_Flow_Updated.png`

Wherever these appear (backend responses, UI links, `CODEX_COMMAND` logs, tools) they are treated as **URLs** – the runtime transforms `/mnt/data/...` into real, fetchable URLs.

**Multi-agent architecture**

- DevSupport agent – debugs decisions, tests, and outages.
- Regulatory Explainer agent – answers “why did we block this?” using RAG.
- Form Copilot agent – guides users through CSF / Ohio forms and catches issues early.

**DevSupport tooling**

- `CODEX_COMMAND` log protocol (structured logs for every key action).
- In-app **DevSupport Log Panel** to view those events live.
- **Copy cURL** buttons for every evaluate / explain / RAG call.
- **API status chip** that pings `/health` and logs `check_api_health`.
- n8n workflow blueprints for:
  - DevSupport webhook,
  - RegOps daily digest,
  - Form escalation.

---

## 🧱 Architecture at a glance

**Backend (FastAPI)**

- `GET /health` – health check.
- CSF decision engines:
  - `POST /csf/practitioner/evaluate`
  - `POST /csf/hospital/evaluate`
  - `POST /csf/researcher/evaluate`
  - `POST /csf/surgery-center/evaluate`
  - `POST /csf/ems/evaluate`
- CSF explain:
  - `POST /csf/explain`
- Ohio TDDD:
  - `POST /ohio-tddd/evaluate`
  - `POST /ohio-tddd/explain`
- Compliance artifacts registry:
  - `GET /compliance/artifacts` → maps flows to `/mnt/data/...` documents
- Controlled substances:
  - `GET /controlled-substances/search`
  - `GET /controlled-substances/history`
- RAG regulatory explain:
  - `POST /rag/regulatory-explain`

**Frontend (React)**

- **CSF sandboxes** for all form types:
  - Form editor, Evaluate, Explain, Deep RAG explain
  - Controlled Substances panel (search + history)
  - Quick example scenarios (FL Schedule II, OH Schedule II, etc.)
  - Source document chip → opens `/mnt/data/...` PDFs
- **Ohio TDDD sandbox** with its own examples and HTML doc:
  - `"/mnt/data/Ohio TDDD.html"`
- **RAG playground**:
  - Browses compliance artifacts
  - “View document” links use `artifact.source_document` (a `/mnt/data/...` URL)
  - Quick RAG examples (“Hospital vs Practitioner CSF”, “Out-of-state Ohio shipping”, etc.)
- **Regulatory Flows panel**:
  - Links to:
    - `/mnt/data/Controlledsubstance_userflow.png`
    - `/mnt/data/Controlled_Substances_Form_Flow_Updated.png`
  - Each click logs `open_regulatory_flow_diagram`
- **DevSupport console**:
  - Toggle button in header (`DevSupport`)
  - Live view of all `CODEX_COMMAND` events
  - Expand/collapse payloads, copy JSON

---

## ▶️ Running the project

### Quick troubleshooting: “Check & Explain” button

The **Check & Explain** (Form Copilot) CTA sends multiple API calls when clicked:

- Snapshots the current decision to `/decisions/history` and submits a verification request to `/verifications/submit`.
- Asks the regulatory RAG endpoint (`/rag/regulatory-explain`) to summarize the decision.

If the backend is not running or `VITE_API_BASE` is misconfigured, the browser will throw errors (for example, a 500 that surfaces as “Cannot read properties of null (reading 'save')”) and the UI will show “Form Copilot could not run”. Start the FastAPI server and point the frontend at it:

```bash
# Terminal 1 – backend
cd backend
uvicorn src.api.main:app --reload --port 8000

# Terminal 2 – frontend
cd frontend
VITE_API_BASE="http://localhost:8000/api/v1" npm run dev
```

With the API running at the configured base URL, the **Check & Explain** flow will be able to record history, submit verification requests, and fetch the explanatory RAG answer without runtime errors.

### Backend

From `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.api.main:app --reload
```

By default, the backend exposes FastAPI routes at something like:

```
http://127.0.0.1:8000/health

http://127.0.0.1:8000/csf/practitioner/evaluate

etc.
```

Run tests:

```bash
cd backend
pytest
```

### Frontend

From `frontend/`:

Set `VITE_API_BASE` in your `.env` (or via command line):

```
VITE_API_BASE=http://127.0.0.1:8000
```

Install & run:

```bash
npm install
npm run dev
```

Open the app (usually http://localhost:5173) to access all sandboxes and tools.

---

## 🧪 How to demo quickly

A few “talk-track ready” flows:

1. **Practitioner FL Schedule II**

   - Open the Practitioner CSF sandbox.
   - Click a FL Schedule II example chip to prefill the form.
   - Click Evaluate CSF, then Explain decision.
   - Run Deep RAG Explain to see a narrative explanation grounded in the practitioner CSF PDF.
   - Click the Practitioner CSF PDF chip to open:
     - `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`
   - Open the DevSupport panel to show:
     - `explain_csf_practitioner_decision`
     - `rag_regulatory_explain_practitioner`
     - `copy_curl` events.

2. **Ohio TDDD – Out-of-state shipping**

   - Open the Ohio TDDD sandbox.
   - Choose the “Out-of-state shipping” example.
   - Evaluate and explain.
   - Open the Ohio doc:
     - `/mnt/data/Ohio TDDD.html`
   - Show the associated `CODEX_COMMAND` logs and copy-cURL for `/ohio-tddd/evaluate` and `/ohio-tddd/explain`.

3. **RAG Playground – Hospital vs Practitioner**

   - Open the RAG Regulatory playground.
   - Select relevant CSF artifacts (practitioner + hospital).
   - Click the “Hospital vs Practitioner CSF” quick example.
   - Run RAG explain.
   - Use View document links to open `/mnt/data/...` PDFs.

---

## 📚 Deeper docs

For more detail, see the docs under `docs/`:

- `docs/project_overview.md` – high-level narrative of the whole system.
- `docs/devsupport_codex_commands.md` – full `CODEX_COMMAND` catalog.
- `docs/multi_agent_architecture.md` – multi-agent design + orchestration.
- `docs/n8n_workflow_blueprints.md` – how to wire this into n8n (DevSupport webhook, RegOps digest, escalation flows).

### Vertical portfolio

AutoComply AI ships with a growing set of demo-ready compliance verticals
on a shared decision core and RAG layer, including:

- NY Pharmacy vertical
- Ohio Hospital vertical
- Facility CSF vertical
- Practitioner CSF vertical
- EMS CSF vertical
- Researcher CSF vertical
- Surgery Center CSF vertical

For a summary of how to demo each vertical and how they connect to the
frontend sandboxes and backend endpoints, see:

- `backend/docs/verticals/vertical_portfolio_overview.md`

