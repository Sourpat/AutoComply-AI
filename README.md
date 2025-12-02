# AutoComply AI

> A regulatory copilot playground for controlled substances and drug distribution flows.  
> Built with FastAPI + React, RAG, multi-agent architecture, and DevSupport tooling.

AutoComply AI simulates a realistic compliance environment where:

- Deterministic engines (CSF + Ohio TDDD) make **hard regulatory decisions**,
- A **RAG pipeline** explains those decisions using real documents (PDF/HTML) under `/mnt/data/...`,
- A **multi-agent** layer (DevSupport / Regulatory Explainer / Form Copilot) can sit on top,
- A React frontend exposes **sandbox UIs** for demos and interviews,
- **DevSupport affordances** (CODEX logs, DevSupport console, copy-cURL, health chip) make debugging and orchestration easy.
- **Controlled Substance Forms (CSF) Suite** – multi-tenant sandboxes + RAG explanations for Hospital, Practitioner, Facility, EMS, and Researcher CSFs. See [`docs/csf_suite_overview.md`](docs/csf_suite_overview.md) for details.

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
