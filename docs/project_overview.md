# AutoComply AI – Project & Architecture Overview

AutoComply AI is a **regulatory copilot** for controlled substances and
drug-distribution workflows.

It simulates a real-world environment where:

- Deterministic engines (CSF + Ohio TDDD) make **hard compliance decisions**,
- A **RAG pipeline** explains those decisions using real regulatory docs,
- A **multi-agent architecture** (DevSupport, Regulatory Explainer, Form
  Copilot) can be layered on top,
- A React frontend exposes **sandbox UIs** for testing, demos, and interviews,
- **DevSupport affordances** (CODEX logs, cURL buttons, health chips) make it
  easy to debug and orchestrate with tools like **n8n**.

The project is intentionally designed to be **resume / portfolio ready**: each
piece maps cleanly to “trending” AI and product-engineering concepts.

---

## 1. Core Problem & Scope

AutoComply AI focuses on controlled substances and licensing flows that are
typical in healthcare / dental / hospital commerce:

- **Controlled Substances Forms (CSF)** for:
  - Practitioner (dental/medical practices),
  - Hospital pharmacy,
  - Researcher,
  - Surgery Center,
  - EMS.

- **Ohio TDDD** (Terminal Distributor of Dangerous Drugs) rules.

The project does **not** try to implement full real-world regulations, but
instead:

1. Provides realistic **decision engines** and payloads,
2. Wires them to **explain** and **RAG** layers,
3. Uses **real documents** (PDF/HTML) under `/mnt/data/...` as the primary
   regulatory knowledge base.

---

## 2. Backend Overview (FastAPI)

The backend is a FastAPI service with the following key areas:

### 2.1 Health & Infrastructure

- `GET /health`  
  Simple health endpoint used by:
  - The UI API status chip,
  - n8n workflows,
  - DevSupport agents.

### 2.2 CSF Engines & Explain

For each CSF type there is an `evaluate` endpoint that returns a structured
decision, plus a shared **explain API**:

- Practitioner:
  - `POST /csf/practitioner/evaluate`
- Hospital:
  - `POST /csf/hospital/evaluate`
- Researcher:
  - `POST /csf/researcher/evaluate`
- Surgery Center:
  - `POST /csf/surgery-center/evaluate` (or similar path)
- EMS:
  - `POST /csf/ems/evaluate`

Explain endpoint:

- `POST /csf/explain`

These decisions provide:

- A **status** (allowed / blocked / manual_review),
- Metadata about **why** (rules, thresholds, jurisdiction).

### 2.3 Ohio TDDD Engine & Explain

- `POST /ohio-tddd/evaluate`
- `POST /ohio-tddd/explain`

Models the idea of Ohio TDDD checks (e.g., in-state vs out-of-state, account
types, etc.).

### 2.4 Compliance Artifacts Registry

- `GET /compliance/artifacts`

Returns a list of **ComplianceArtifact** entries that map engine/flows to real
documents under `/mnt/data/...`, for example:

- `"/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"`
- `"/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf"`
- `"/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf"`
- `"/mnt/data/Online Controlled Substance Form - Researcher form.pdf"`
- `"/mnt/data/Online Controlled Substance Form - EMS form.pdf"`
- `"/mnt/data/FLORIDA TEST.pdf"`
- `"/mnt/data/addendums.pdf"`
- `"/mnt/data/Ohio TDDD.html"`
- `"/mnt/data/Controlled_Substances_Form_Flow_Updated.png"`

> **Important:** Wherever these `/mnt/data/...` paths appear (backend responses,
> logs, UI links, or agent tools), they are treated as **URLs**. The runtime
> transforms them into actual, accessible URLs when needed.

### 2.5 Controlled Substances Catalog & History

- `GET /controlled-substances/search?q=...`  
  For live drug search (e.g., Oxycodone 5mg tablet, Hydrocodone/Acetaminophen).
- `GET /controlled-substances/history?account_number=...`  
  For account-level substance history (used in UI and agents).

### 2.6 RAG Regulatory Explain

- `POST /rag/regulatory-explain`

A single, generic endpoint that takes:

- A **question**,
- Optional **decision** object,
- Optional **regulatory_references** from the engine,
- Optional **source_document** references.

It then uses a **RAG pipeline** (LangChain-based when enabled, stub when not)
to:

- Load underlying PDFs/HTML from `/mnt/data/...`,
- Retrieve relevant passages,
- Generate a grounded explanation.

---

## 3. Frontend Overview (React)

The frontend is a React app that acts as a **sandbox UI** for all flows.

### 3.1 Shell & Global UX

- **API Status Chip** (`ApiStatusChip`):
  - Pings `GET /health` on load,
  - Shows “API online/offline/Checking…”,
  - Logs `CODEX_COMMAND: check_api_health`.

- **Source Document Chips** (`SourceDocumentChip`):
  - For each sandbox, a chip like “Practitioner CSF PDF” that links directly
    to the relevant `/mnt/data/...` document.
  - Logs `CODEX_COMMAND: open_regulatory_source_document` with the `url` set
    to the `/mnt/data/...` path.

- **Copy cURL Buttons** (`CopyCurlButton`):
  - For every evaluate / explain / RAG call, there’s a “Copy cURL” button.
  - Generates a fully-formed `curl -X POST ...` including JSON body.
  - Logs `CODEX_COMMAND: copy_curl` with endpoint + payload.

### 3.2 CSF Sandboxes

For each CSF type there is a dedicated sandbox component:

- Practitioner (`PractitionerCsfSandbox`)
- Hospital
- Researcher
- Surgery Center
- EMS

Each sandbox includes:

1. **Form editor** for that CSF type (facility, account, practitioner, licenses).
2. **Evaluate** button (hits the correct `/csf/.../evaluate` endpoint).
3. **Explain decision** button (hits `/csf/explain`).
4. **Deep RAG Explain** section that uses `/rag/regulatory-explain`.
5. **Controlled Substances Panel**:
   - Live search via `GET /controlled-substances/search`,
   - Account history via `GET /controlled-substances/history`,
   - Selected substances persist as part of the sandbox state.
6. **Quick Example Scenarios**:
   - One-click buttons that prefill realistic FL / OH / Schedule II cases,
   - Log `CODEX_COMMAND: csf_*_example_selected` with the resulting form +
     `source_document`.

### 3.3 Ohio TDDD Sandbox

A dedicated Ohio TDDD sandbox:

- Ohio-specific form fields,
- Evaluate + Explain + optional RAG explain,
- Quick examples like:
  - “OH – In-state pharmacy”,
  - “OH – Out-of-state shipping”.
- “Ohio TDDD HTML” source chip linking to:
  - `"/mnt/data/Ohio TDDD.html"`

### 3.4 RAG Playground

A **RAG Regulatory Explain playground** that lets users:

- Select artifacts from the `/compliance/artifacts` registry,
- See **“View document”** links per artifact (using `artifact.source_document`
  directly as `href` / `url`),
- Enter a free-text question,
- Call `/rag/regulatory-explain`.

Features:

- **Quick RAG Example Scenarios**:
  - Example chips like:
    - “FL Schedule II – Practitioner”,
    - “Hospital vs Practitioner CSF”,
    - “Ohio TDDD – Out-of-state shipping”,
    - “Manual review playbook”.
  - Clicking a chip pre-fills the question and logs:
    - `CODEX_COMMAND: rag_example_selected`.

---

## 4. DevSupport & Observability

AutoComply AI is instrumented with a `CODEX_COMMAND` logging protocol for
DevSupport / agents, documented in:

- `docs/devsupport_codex_commands.md`.

### 4.1 CODEX Commands

Examples:

- `explain_csf_practitioner_decision`
- `explain_csf_hospital_decision`
- `explain_csf_researcher_decision`
- `explain_csf_surgery_center_decision`
- `explain_csf_ems_decision`
- `explain_ohio_tddd_decision`
- `rag_regulatory_explain_practitioner` (and variants)
- `open_regulatory_source_document`
- `check_api_health`
- `copy_curl`
- `csf_*_example_selected`
- `ohio_tddd_example_selected`
- `rag_example_selected`

Each log includes a structured JSON payload with:

- `form`,
- `decision`,
- `explanation` (if any),
- `controlled_substances` (for CSF),
- `source_document` path (e.g., `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`),
- Any scenario metadata (`example_id`, `label`, etc.).

These logs are designed so a **DevSupport AI agent** or **n8n workflow** can:

- Re-call evaluate/explain endpoints,
- Call `/rag/regulatory-explain`,
- Open `/mnt/data/...` documents via `url`,
- Generate summaries or debug reports.

---

## 5. Multi-Agent & Orchestration

The multi-agent design is described in:

- `docs/multi_agent_architecture.md`

Key agents:

1. **DevSupport Agent**
   - Debugs decisions and tests,
   - Uses evaluate + explain + RAG + history,
   - Reads `CODEX_COMMAND` logs.

2. **Regulatory Explainer Agent**
   - Answers “why” / “what does the rule say”,
   - Combines artifacts registry + `/mnt/data/...` docs + RAG.

3. **Form Copilot Agent**
   - Guides users through CSF / Ohio forms,
   - Calls controlled-substance search,
   - Uses evaluate/explain to catch conflicts.

A router/orchestrator node (LangGraph-style) routes intents to the right agent
using a small state machine.

### 5.1 n8n Blueprints

- Documented in `docs/n8n_workflow_blueprints.md`.

Blueprints:

1. **DevSupport Webhook** (`codex_dev_support_webhook`):
   - Receives `CODEX_COMMAND` events (e.g., from logs),
   - Calls evaluate/explain,
   - Uses an LLM to summarise,
   - Notifies Slack / email.

2. **RegOps Daily Digest** (`regops_daily_digest`):
   - Cron-based,
   - Calls `/health`, `/compliance/artifacts`,
   - Fetches recent `CODEX_COMMAND` events from a log store,
   - Uses LLM to produce a daily compliance digest,
   - Emails / posts it.

3. **Form Copilot Escalation** (`form_copilot_escalation`):
   - Triggered when users are stuck,
   - Captures `form`, `decision`, `user_question`, `source_document`,
   - Generates a support-friendly summary,
   - Sends to a support or clinical channel.

All blueprints treat `/mnt/data/...` document paths as **URLs** that can be
directly used in HTTP or tool calls.

---

## 6. Running & Demoing

### 6.1 Local Dev (high level)

- Backend:
  - Install from `backend/requirements.txt`,
  - Run FastAPI (e.g., `uvicorn src.api.main:app --reload`).
- Frontend:
  - Configure `VITE_API_BASE` to point to backend,
  - Run `npm install` / `npm run dev` (or equivalent).

### 6.2 Demo Scenarios

Some quick demo flows:

1. **Practitioner FL Schedule II**
   - Open Practitioner CSF sandbox,
   - Click a **FL Schedule II example** chip,
   - Click **Evaluate**, then **Explain decision**, then **Deep RAG explain**,
   - Click **Practitioner CSF PDF** source chip to view the underlying PDF.

2. **Ohio TDDD Out-of-State**
   - Open Ohio TDDD sandbox,
   - Choose the “Out-of-state shipping” example,
   - Evaluate + explain,
   - Show the **Ohio TDDD HTML** source document:
     - `"/mnt/data/Ohio TDDD.html"`.

3. **RAG Playground – Hospital vs Practitioner**
   - Open RAG playground,
   - Select relevant CSF artifacts (practitioner + hospital),
   - Click the “Hospital vs Practitioner CSF” quick example,
   - Run RAG explain and show **View document** links for each artifact.

4. **DevSupport Story**
   - Trigger an explain in any sandbox,
   - Show:
     - `CODEX_COMMAND` logs,
     - **Copy cURL**,
     - **API online** chip,
     - How n8n or agents could consume the logs.

---

## 7. How to Use This in a Portfolio / Interview

You can describe AutoComply AI as:

> A compliance-focused AI copilot playground that combines deterministic
> regulatory engines (CSF + Ohio TDDD), RAG over real regulatory PDFs/HTML, a
> multi-agent architecture (DevSupport, Regulatory Explainer, Form Copilot),
> and observability hooks (CODEX logs, copy-cURL, health checks) wired into
> tools like n8n.

And then, if needed, you can deep-dive into:

- `docs/multi_agent_architecture.md` – agent design and LangGraph-style graph,
- `docs/devsupport_codex_commands.md` – log protocol,
- `docs/n8n_workflow_blueprints.md` – workflow integration,
- The actual sandboxes & RAG playground in the UI.

This document (`project_overview.md`) is the high-level entry point tying all
of that together.
