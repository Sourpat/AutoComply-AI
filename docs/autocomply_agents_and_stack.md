# AutoComply AI – Architecture & AI Agents Overview

This document explains the core architecture of AutoComply AI, how the backend
and frontend are wired, and how AI agents (Codex, RAG, co-pilots) interact with
regulatory documents stored under `/mnt/data/...`.

It is intended as a dev-facing overview and as a portfolio-ready reference.

---

## 1. High-level Architecture

AutoComply AI has three main layers:

1. **Deterministic decision engines (FastAPI backend)**
   - Controlled Substance Forms (CSF) engines:
     - Practitioner
     - Hospital Pharmacy
     - Surgery Center
     - Researcher
     - EMS
   - Ohio TDDD decision engine.

2. **Regulatory content and coverage**
   - Local PDFs/HTML stored under `/mnt/data/...`.
   - A coverage registry (`ComplianceArtifact`) that maps:
     - `id` → human name, jurisdiction, and `source_document` path.
   - Decision models that carry `regulatory_references: List[str]` linking each
     verdict back to specific artifacts in coverage.

3. **Interactive sandbox UI (React/Vite frontend)**
   - CSF sandboxes for each facility type.
   - Ohio TDDD sandbox.
   - Explain buttons (`/csf/explain`, `/ohio-tddd/explain`).
   - Regulatory basis pills showing which artifacts informed a decision.
   - API status chip that pings `/health`.

---

## 2. Backend – FastAPI Decision Engine

**Tech**: Python, FastAPI, Pydantic v2, pytest.

### 2.1. CSF Engines

For each CSF type we have:

- Domain models in `autocomply/domain/csf_*.py`:
  - `*CsfForm` – request schema.
  - `*CsfDecision` – response schema with:
    - `status` (e.g. `ok_to_ship`, `blocked`, `manual_review`),
    - `reason` (human-readable),
    - `missing_fields: List[str]`,
    - `regulatory_references: List[str]` (link to coverage artifacts).

- Example coverage artifacts (in `compliance_artifacts`):

  ```text
  csf_practitioner_form  → /mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf
  csf_hospital_form      → /mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf
  csf_surgery_center_form→ /mnt/data/Online Controlled Substance Form - Surgery Center form.pdf
  csf_researcher_form    → /mnt/data/Online Controlled Substance Form - Researcher form.pdf
  csf_ems_form           → /mnt/data/Online Controlled Substance Form - EMS form.pdf
  csf_fl_addendum        → /mnt/data/FLORIDA TEST.pdf
  csf_addendums          → /mnt/data/addendums.pdf
  ```

Examples of rules:

Missing core fields → status=blocked, regulatory_references=[<base_form_id>].

Attestation not accepted → status=blocked, regulatory_references=[<base_form_id>].

High-risk Schedule II items to FL:

status=manual_review,

regulatory_references=[<base_form_id>, "csf_fl_addendum"].

Fully valid CSF → status=ok_to_ship,
regulatory_references=[<base_form_id>].

### 2.2. Ohio TDDD Engine

Domain models in autocomply/domain/ohio_tddd.py:

- `OhioTdddForm`
- `OhioTdddDecision` with:
  - `status` (e.g. `approved`, `blocked`, `manual_review`),
  - `reason`,
  - `missing_fields`,
  - `regulatory_references`.

Coverage artifact:

- `ohio_tddd_registration` → `/mnt/data/Ohio TDDD.html`


Example rules:

Missing required fields → status=blocked, regulatory_references=["ohio_tddd_registration"].

Out-of-state shipping (e.g., ship_to_state != "OH") → status=manual_review,
regulatory_references=["ohio_tddd_registration"].

Fully valid in-state application → status=approved,
regulatory_references=["ohio_tddd_registration"].

### 2.3. Explain Endpoints

To provide narrative UI- and agent-friendly explanations, we expose:

- `POST /csf/explain`
  - Body:
    - `csf_type` (`practitioner | hospital | researcher | surgery_center | ems`)
    - `decision` (minimal `CsfDecisionSummary`).
  - Response: `CsfExplanation` with:
    - `explanation` (multi-line text),
    - `regulatory_references` (echoed).

- `POST /ohio-tddd/explain`
  - Body:
    - `decision`: `OhioTdddDecisionSummary`.
  - Response: `OhioTdddExplanation`.

These endpoints:

- Do not re-evaluate forms.
- Take the decision JSON as input.
- Use `regulatory_references` to fetch coverage artifacts and embed them in the
  explanation (“Regulatory basis” section).

---

## 3. Frontend – React/Vite Regulatory Sandbox

**Tech**: React, TypeScript, Vite, Tailwind.

### 3.1. CSF Sandboxes

For each CSF type we provide:

- A form panel for the input (`*CsfFormData`).
- A controlled substances search & “recent items for this account” section
  backed by:
  - `GET /controlled-substances/search?q=...`
  - `GET /controlled-substances/history?account_number=...`
- An “Evaluate” action calling the appropriate API route:
  - e.g. `POST /csf/practitioner/evaluate`.
- After evaluation, the sandbox shows:
  - A decision card:
    - Status chip,
    - Reason,
    - Missing fields.
  - An **Explain decision** button:
    - Calls `POST /csf/explain`.
    - Renders the explanation in a `<pre>` block.
  - A **Regulatory basis** section:
    - Uses `decision.regulatory_references`.
    - Calls `GET /compliance/artifacts`.
    - Renders pills like:
      - `Controlled Substance Form – Practitioner (Standard) [US-Multi]`
      - `Florida Controlled Substances Addendum [US-FL]`.

### 3.2. Ohio TDDD Sandbox

- Lightweight form for:
  - `businessName`, `licenseType`, `licenseNumber`, `shipToState`.
- Evaluate button calling `POST /ohio-tddd/evaluate`.
- Explain + regulatory basis behavior mirroring CSF:
  - `POST /ohio-tddd/explain`,
  - `GET /compliance/artifacts` → `ohio_tddd_registration`.

---

## 4. DevSupport Codex Commands

The frontend emits structured console logs that a DevSupport/Codex agent can
consume. Example pattern:

```javascript
console.log("CODEX_COMMAND: explain_csf_practitioner_decision", {
  form,                    // JSON sent to /csf/practitioner/evaluate
  decision,                // JSON received from the backend
  explanation,             // optional: text from /csf/explain
  controlled_substances,   // items attached in the sandbox
  source_document:
    "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
});
```

Common command names:

- `explain_csf_practitioner_decision`
- `explain_csf_hospital_decision`
- `explain_csf_researcher_decision`
- `explain_csf_surgery_center_decision`
- `explain_csf_ems_decision`
- `explain_ohio_tddd_decision`

Important convention:

- `source_document` is always a local path under `/mnt/data/...`, e.g.:
  - `/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf`
  - `/mnt/data/FLORIDA TEST.pdf`
  - `/mnt/data/Ohio TDDD.html`
- Tools/agents are responsible for transforming this path into a real URL when
  fetching the content. The backend and coverage layer always use the local
  path as the canonical reference.

This makes it easy for agents to:

- Inspect `decision.status`, `reason`, `missing_fields`.
- Resolve `regulatory_references` via `/compliance/artifacts`.
- Open `source_document` as a PDF/HTML to ground explanations.
- Optionally call the explain endpoints again for a fresh narrative.

---

## 5. AI Agents & Orchestration Roadmap

AutoComply AI is designed to support multiple AI agents on top of the same
Deterministic core:

- **DevSupport / Codex Agent**
  - Consumes `CODEX_COMMAND: ...` logs.
  - Calls:
    - `/csf/.../evaluate`
    - `/csf/explain`
    - `/ohio-tddd/evaluate`
    - `/ohio-tddd/explain`
    - `/compliance/artifacts`
  - Opens `/mnt/data/...` documents for grounded debugging and rule design.

- **Regulatory Explainer (RAG Agent)**
  - Built with LangChain/LangGraph.
  - Indexes:
    - CSF form PDFs,
    - Florida addendum,
    - Ohio TDDD HTML.
  - Provides citation-rich explanations for rules and decisions, exposed via
    a dedicated `/rag/...` API.

- **CSF Form Co-pilot**
  - Helps users fill CSF forms by:
    - Surfacing missing fields,
    - Running “dry-run” evaluations,
    - Explaining requirements using RAG + engine feedback.

- **Ohio TDDD Assistant**
  - Specializes in TDDD registration flows:
    - Detects cross-state shipping,
    - Validates required fields,
    - Explains approval, block, and manual review scenarios.

- **n8n Workflows**
  - Orchestrate GitHub, Slack, and the decision engine:
    - Auto-run tests and checks on PR merges.
    - Trigger CSF/TDDD evaluations and explanations.
    - Route grounded summaries to compliance or engineering channels.

---

## 6. Deployment Targets (for resume / real-world use)

- **Backend (FastAPI):**
  - Target: Render / Railway / Fly.io.
  - CI: GitHub Actions running full pytest suite before deploy.

- **Frontend (React/Vite):**
  - Target: Vercel / Netlify.
  - Config:
    - `VITE_API_BASE` pointing at the deployed backend.

- **RAG & Agents:**
  - Hosted alongside backend or as separate microservices.
  - Integrated via HTTP APIs and n8n workflows.

This end-to-end architecture supports both deterministic compliance decisions
and AI-augmented explanations, with every path traceable back to specific
regulatory documents under `/mnt/data/....`
