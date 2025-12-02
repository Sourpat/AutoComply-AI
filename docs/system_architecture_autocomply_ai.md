# AutoComply AI – System Architecture

This document explains how the AutoComply AI platform is structured end-to-end:

- Frontend sandboxes and consoles (CSF Suite, License Suite, Order Journeys).
- FastAPI backend APIs (CSF engines, License engines, Mock Order engines).
- AI / RAG layer (copilots and regulatory document retrieval).
- Hosting and automation (Vercel, Render, n8n – conceptually).

---

## 1. High-Level Architecture (Mermaid Diagram)

```mermaid
flowchart LR
    subgraph User
        U[Browser / Tester / Stakeholder]
    end

    subgraph Frontend["Frontend (Vercel, Vite + React + TS)"]
        CSFUI[CSF Sandboxes\n(Hospital, Facility, Practitioner, EMS, Researcher)]
        LICENSEUI[License Playground\n(Ohio TDDD, NY Pharmacy)]
        CONSOLE[Compliance Console\n(Ohio Order Journey Card)]
    end

    subgraph Backend["Backend (Render, FastAPI)"]
        subgraph CSF["CSF Suite"]
            CSF_API[/CSF APIs\n/csf/hospital/evaluate\n/csf/hospital/form-copilot\n.../csf/{type}/.../]
        end

        subgraph LICENSE["License Suite"]
            OH_TDDD_API[/Ohio TDDD APIs\n/license/ohio-tddd/evaluate\n/license/ohio-tddd/form-copilot/]
            NY_PHARM_API[/NY Pharmacy APIs\n/license/ny-pharmacy/evaluate\n/license/ny-pharmacy/form-copilot/]
        end

        subgraph ORDER["Mock Order Engines"]
            OH_ORDER_API[/Ohio Hospital Order Mock\n/orders/mock/ohio-hospital-approval/]
        end

        subgraph RAG["AI / RAG Layer\n(LangChain / LangGraph-style patterns)"]
            CSF_COPILOT[(CSF Form Copilot)]
            LICENSE_COPILOT[(License Copilot)]
        end
    end

    subgraph Docs["Regulatory / Form Documents\n(Vector Store)"]
        HOSP_DOC[(Hospital CSF form)]
        FACILITY_DOC[(Facility CSF form)]
        PRACT_DOC[(Practitioner CSF form)]
        EMS_DOC[(EMS CSF form)]
        RESEARCH_DOC[(Research CSF form)]
        OHIO_TDDD_DOC[(ohio_tddd_rules)]
        NY_PHARM_DOC[(ny_pharmacy_rules)]
    end

    subgraph Automation["Automation / Observability (n8n, etc.)"]
        N8N[(Workflows: Health checks,\nRe-ingestion, Alerts)]
    end

    U --> CSFUI
    U --> LICENSEUI
    U --> CONSOLE

    CSFUI --> CSF_API
    LICENSEUI --> OH_TDDD_API
    LICENSEUI --> NY_PHARM_API
    CONSOLE --> OH_ORDER_API

    CSF_API --> CSF_COPILOT
    OH_TDDD_API --> LICENSE_COPILOT
    NY_PHARM_API --> LICENSE_COPILOT
    OH_ORDER_API --> CSF_API
    OH_ORDER_API --> OH_TDDD_API

    CSF_COPILOT --> HOSP_DOC
    CSF_COPILOT --> FACILITY_DOC
    CSF_COPILOT --> PRACT_DOC
    CSF_COPILOT --> EMS_DOC
    CSF_COPILOT --> RESEARCH_DOC

    LICENSE_COPILOT --> OHIO_TDDD_DOC
    LICENSE_COPILOT --> NY_PHARM_DOC

    N8N -.-> CSF_API
    N8N -.-> OH_TDDD_API
    N8N -.-> NY_PHARM_API
    N8N -.-> RAG
```

## 2. Frontend (Vercel – Vite + React + TypeScript)

### Key responsibilities

Render interactive sandboxes and consoles:

CSF Suite:

Hospital, Facility, Practitioner, EMS, Researcher sandboxes.

Each calls /csf/{type}/evaluate and /csf/{type}/form-copilot.

License Suite:

Ohio TDDD sandbox.

NY Pharmacy sandbox.

Compliance Console:

High-level overview of CSF and License Suites.

Ohio Hospital Order Journey card with dev trace.

Normalize decision status visuals:

Reusable DecisionStatusBadge component:

ok_to_ship, needs_review, blocked.

DecisionStatusLegend component explaining each status.

Developer experience:

Ohio Hospital Order Journey card:

3 scenarios:

Happy path (Ohio + valid TDDD).

Negative (Ohio + missing TDDD).

Non-Ohio (CSF only, no TDDD).

Dev trace panel for last request + response.

### Notable frontend modules

components/OhioHospitalOrderJourneyCard.tsx

components/NyPharmacyLicenseSandbox.tsx

components/DecisionStatusBadge.tsx

components/DecisionStatusLegend.tsx

pages/ComplianceConsolePage.tsx

pages/LicenseOverviewPage.tsx

components/*CsfSandbox.tsx for CSF Suite.

## 3. Backend (Render – FastAPI)

The FastAPI backend exposes structured APIs for:

### CSF Suite

Each CSF type (hospital, facility, practitioner, EMS, researcher) has:

POST /csf/{type}/evaluate

POST /csf/{type}/form-copilot

Eval endpoints return:

status, reason, missing_fields.

### License Suite

Ohio TDDD:

POST /license/ohio-tddd/evaluate

POST /license/ohio-tddd/form-copilot

NY Pharmacy:

POST /license/ny-pharmacy/evaluate

POST /license/ny-pharmacy/form-copilot

Uses shared run_license_copilot helper under the hood to keep a consistent contract.

### Mock Order Engines

Ohio Hospital Order Mock:

POST /orders/mock/ohio-hospital-approval

Input:

hospital_csf: CSF payload.

ohio_tddd (optional): Ohio TDDD payload.

Output:

CSF + License decisions.

final_decision.

notes[] describing the journey.

### Testing

Scenario tests:

tests/test_scenario_ohio_hospital_schedule_ii.py

tests/test_order_mock_approval_api.py

License-specific tests:

tests/test_license_ohio_tddd_api.py (pattern).

tests/test_license_ny_pharmacy_api.py.

## 4. AI / RAG Layer (LangChain / LangGraph Patterns)

Inside the FastAPI service, a shared AI / RAG layer handles “copilot” style queries.

### Key responsibilities

CSF Form Copilot:

Ingests CSF-related documents (hospital, facility, practitioner, EMS, researcher forms).

Uses embeddings + vector store to retrieve relevant sections.

Generates explanations:

status, reason, missing_fields,
regulatory_references, rag_explanation,
artifacts_used, rag_sources.

License Copilot:

Ingests license-specific documents:

ohio_tddd_rules

ny_pharmacy_rules

Calm, grounded explanations for each license decision.

Same output contract as CSF Copilot for UI simplicity.

### Why this matters

The UI doesn’t need to know the RAG details.

New license types and forms can reuse the same copilot patterns.

Explanations are traceable via regulatory_references and rag_sources.

## 5. Hosting & Automation

### Frontend – Vercel

Hosts the Vite/React frontend.

Production base URL points to the Render backend.

Allows quick sharing of sandboxes and consoles.

### Backend – Render

Runs FastAPI with:

CSF Suite endpoints.

License Suite endpoints.

Mock Order endpoints.

RAG pipelines.

Manages:

Environment variables (LLM/RAG config, API keys).

Build & deploy from GitHub.

### Automation – n8n (conceptual)

Current prototype wiring (conceptual, ready to be implemented):

Scheduled workflows:

Periodic health checks against key endpoints.

Future: document re-ingestion or vector store refresh.

Event-based flows:

Future: alerts on blocked decisions or high-risk orders.

Future: Slack/email notifications for specific license or CSF anomalies.

### 7. Smoke Testing the Backend

For quick verification that the main compliance flows are reachable and behaving
sanely, there is a small HTTP smoke test script:

- `scripts/smoke_test_autocomply.py`

This script hits:

- `GET /health`
- `POST /csf/hospital/evaluate`
- `POST /license/ohio-tddd/evaluate`
- `POST /license/ny-pharmacy/evaluate`
- `POST /orders/mock/ohio-hospital-approval`
- `POST /orders/mock/ny-pharmacy-approval`

and prints a pass/fail summary.

**Usage**

```bash
# Against a local backend (uvicorn)
python scripts/smoke_test_autocomply.py --base-url http://localhost:8000

# Against a deployed backend (Render, etc.)
python scripts/smoke_test_autocomply.py --base-url https://your-backend-url
```

If any check fails, the script shows the HTTP status and a short detail string to
help narrow down the issue. This is intended as a fast pre-demo sanity check,
not a replacement for full pytest coverage.

---

#### Quick verification

From repo root (with backend running on localhost:8000):

```bash
python scripts/smoke_test_autocomply.py
```

You should see something like:

```
AutoComply AI – HTTP Smoke Test Summary

Check                          OK?   HTTP   Detail
--------------------------------------------------------
health                         ✅    200    status=ok, service=autocomply-ai
csf_hospital_evaluate          ✅    200    status=ok_to_ship, reason=...
license_ohio_tddd_evaluate     ✅    200    status=ok_to_ship, reason=...
license_ny_pharmacy_evaluate   ✅    200    status=ok_to_ship, reason=...
order_mock_ohio_hospital       ✅    200    final_decision=ok_to_ship
order_mock_ny_pharmacy         ✅    200    final_decision=ok_to_ship
--------------------------------------------------------
Overall result: ✅ all checks passed.
```

If something’s off (wrong field name, wrong path), adjust the script to match the actual payload shapes.
