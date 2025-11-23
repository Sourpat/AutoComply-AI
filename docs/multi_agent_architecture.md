# Multi-Agent Architecture – AutoComply AI

This doc describes how AutoComply AI is structured as a set of cooperating
agents that sit on top of:

- Deterministic **decision engines** (CSF, Ohio TDDD, PDMA),
- A **RAG regulatory explain** endpoint,
- A shared **compliance artifacts registry** and `/mnt/data/...` document store,
- Structured **CODEX_COMMAND** logs.

The agents are designed so they can be implemented with tools like
LangChain / LangGraph, but the architecture is library-agnostic.

---

## 1. Core building blocks

### 1.1 Deterministic engines

Each engine takes a structured payload and returns a verdict with status,
reasons, and regulatory references:

- CSF (Controlled Substances Forms):
  - Practitioner – `POST /csf/practitioner/evaluate`
  - Hospital – `POST /csf/hospital/evaluate`
  - Researcher – `POST /csf/researcher/evaluate`
  - Surgery Center – `POST /csf/surgery-center/evaluate`
  - EMS – `POST /csf/ems/evaluate`
  - Explain – `POST /csf/explain`

- Ohio TDDD:
  - Evaluate – `POST /ohio-tddd/evaluate`
  - Explain – `POST /ohio-tddd/explain`

- PDMA Sample:
  - Evaluate – `POST /pdma-sample/evaluate`
  - Explain – `POST /pdma-sample/explain`

All verdicts include `regulatory_references`, for example:

```json
{
  "id": "pdma_sample_eligibility",
  "label": "PDMA-style sample eligibility policy (demo)",
  "source_document": "/mnt/data/FLORIDA TEST.pdf"
}
```

Note: source_document is always a /mnt/data/... path. At runtime it
is treated as a URL; any agent or workflow can pass it into tools directly.

### 1.2 RAG regulatory explain

A single generic endpoint for deep explanations:

`POST /rag/regulatory-explain`

Input (simplified):

```json
{
  "question": "Explain why this PDMA sample is ineligible.",
  "decision": { "...": "..." },
  "regulatory_references": ["pdma_sample_eligibility"]
}
```

The backend uses the references to load documents under /mnt/data/... (PDF,
HTML, PNG if needed), retrieve relevant passages, and generate a grounded
answer.

### 1.3 Compliance artifacts registry

`GET /compliance/artifacts`

Returns ComplianceArtifact entries linking flows to concrete documents:

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

These same paths are used consistently in:

- Engine verdict `regulatory_references`,
- Frontend SourceDocumentChip and RegulatoryFlowsPanel,
- RAG requests,
- CODEX_COMMAND payloads.

### 1.4 CODEX_COMMAND log protocol

The frontend emits structured logs like:

```js
emitCodexCommand("explain_csf_practitioner_decision", {
  form,
  decision,
  explanation,
  controlled_substances,
  source_document:
    "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
});
```

Other examples:

- `evaluate_pdma_sample`
- `explain_pdma_sample_decision`
- `rag_regulatory_explain_pdma`
- `open_regulatory_source_document`
- `open_regulatory_flow_diagram`
- `copy_curl`
- `check_api_health`
- `csf_*_example_selected`
- `ohio_tddd_example_selected`
- `pdma_sample_example_selected`
- `rag_example_selected`

These logs are visible:

- In the DevSupport Log Panel (in-app),
- In the browser console (for external collectors),
- In any external log sink (e.g., n8n webhook, log shipper).

## 2. Agents

There are three main agents:

- DevSupport Agent
- Regulatory Explainer Agent
- Form Copilot Agent

A router/orchestrator sits in front of them.

### 2.1 DevSupport Agent

Intent: Help engineers / ops debug decisions, sandboxes, and outages.

Typical triggers:

- New CODEX_COMMAND events (e.g., from DevSupport log or webhook).
- Manual request from a developer (“why is this blocked?”).

Inputs:

- Engine decision payloads (form, decision, reasons).
- `source_document` (a /mnt/data/... URL).
- Recent RAG answers (if present).
- API health (GET /health).
- Related CODEX events (copy-cURL, example selections, etc.).

Tools it calls:

- Engine explain: `/csf/explain`, `/ohio-tddd/explain`, `/pdma-sample/explain`
- RAG explain: `/rag/regulatory-explain`
- Artifacts: `/compliance/artifacts`
- Health: `/health`
- Raw docs: Direct HTTP GET against `/mnt/data/...` URLs if a tools layer supports that.

Outputs:

- Developer-facing summaries:
  - “Here is why the PDMA sample is ineligible and which rules fired.”
  - “Ohio TDDD blocked due to out-of-state shipping; see Ohio TDDD HTML.”
- Routed to:
  - Slack / Teams / email via n8n,
  - In-app DevSupport views,
  - CI logs.

### 2.2 Regulatory Explainer Agent

Intent: Answer “why did we allow/block this?” in human language.

Inputs:

- Engine decision + explain payloads.
- RAG responses (via `/rag/regulatory-explain`).
- Artifact metadata and `/mnt/data/...` documents.

Tools it calls:

- `/rag/regulatory-explain` with:
  - `question` = user question,
  - `decision` = engine verdict,
  - `regulatory_references` = IDs from decision.
- Artifacts + docs: `/compliance/artifacts`, direct `/mnt/data/...` URLs.

Outputs:

- End-user or internal “explainability” text, e.g.:
  - “Your PDMA sample is ineligible because this is a government account and the demo PDMA policy forbids samples to government entities (see PDMA policy PDF).”
- Can be displayed:
  - In sandboxes (we already do this for RAG),
  - In tickets / audit logs.

### 2.3 Form Copilot Agent

Intent: Help users fill forms correctly and avoid avoidable blocks.

Inputs:

- Partial or complete forms (CSF, Ohio, PDMA).
- Previous decisions for the same account (via history endpoints).
- Controlled substances search/history for CSF flows.

Tools it calls:

- CSF / Ohio / PDMA evaluate endpoints (possibly in “draft” mode).
- Controlled substances APIs:
  - `GET /controlled-substances/search`
  - `GET /controlled-substances/history`
- RAG explain (for contextual guidance): `/rag/regulatory-explain`
- Artifacts + `/mnt/data/...` docs for guidance text.

Outputs:

- Field-level suggestions:
  - “This account is marked as government; PDMA samples are likely ineligible.”
  - “Ohio shipping appears out-of-state; confirm license or use a different location.”
- Explanations and hints in UI or chat form.

## 3. Router / Orchestrator

A simple state machine (LangGraph-style) routes requests to the appropriate agent.

### 3.1 Intents

Sample top-level intents:

- `debug_decision` → DevSupport Agent
- `explain_to_user` → Regulatory Explainer Agent
- `guide_form` → Form Copilot Agent

Intent detection can be as simple as:

- Pattern over CODEX_COMMAND types,
- A small LLM-based classifier.

### 3.2 State shape (example)

```ts
type AgentState = {
  intent: "debug_decision" | "explain_to_user" | "guide_form";
  engine_family?: "csf" | "ohio_tddd" | "pdma";
  form?: unknown;
  decision?: unknown;
  regulatory_references?: string[];
  question?: string;
  answer?: string;
  logs?: unknown[];
};
```

The graph:

- Router node sets intent and engine_family.
- Agent node runs (DevSupport / Explainer / Form Copilot).
- RAG node is optionally called when deeper context is needed.
- Sink node returns final text plus any useful links (e.g. /mnt/data/...).

## 4. How this ties into the UI

The React app already emits the right signals and calls the right endpoints:

- Sandboxes call evaluate / explain / RAG for CSF, Ohio, PDMA.
- Every important action emits a CODEX_COMMAND log.
- Source document chips and regulatory flows panels expose /mnt/data/... URLs.
- The DevSupport Log Panel shows live CODEX_COMMAND events.

This architecture doc is the blueprint for plugging in:

- A LangGraph-based orchestrator,
- A separate DevSupport bot,
- Or n8n workflows that call the same endpoints.

---
