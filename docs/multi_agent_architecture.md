# AutoComply AI – Multi-Agent / LangGraph Architecture

This document describes how AutoComply AI can be orchestrated using a
**multi-agent** architecture (e.g., with LangGraph or similar frameworks).
The goal is to combine:

- Deterministic decision engines (CSF + Ohio TDDD),
- Explain APIs,
- RAG pipeline over `/mnt/data/...` regulatory documents,
- Dev/ops workflows (tests, GitHub, n8n, etc.),

into a single, agentic system that feels like a “RegOps copilot”.

This is an **architecture blueprint** – the HTTP APIs and RAG building blocks
already exist; this doc defines how they are composed by agents.

---

## 1. Core Components Available to Agents

### 1.1 Backend HTTP API (FastAPI)

Agents treat the backend as a toolset:

- **Health**
  - `GET /health`

- **Compliance artifacts registry**
  - `GET /compliance/artifacts`
  - Returns artifact IDs, names, jurisdictions, types and `source_document`
    fields that point to local regulatory files like:

    - `/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf`
    - `/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf`
    - `/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf`
    - `/mnt/data/Online Controlled Substance Form - Researcher form.pdf`
    - `/mnt/data/Online Controlled Substance Form - EMS form.pdf`
    - `/mnt/data/FLORIDA TEST.pdf`
    - `/mnt/data/addendums.pdf`
    - `/mnt/data/Ohio TDDD.html`

- **Deterministic decision engines**
  - Practitioner/Hospital/Researcher/Surgery Center/EMS CSF:
    - `POST /csf/<type>/evaluate`
  - Ohio TDDD:
    - `POST /ohio-tddd/evaluate`

- **Explain APIs (engine-level)**
  - CSF: `POST /csf/explain`
  - Ohio TDDD: `POST /ohio-tddd/explain`

- **RAG regulatory explain (stub or real RAG)**
  - `POST /rag/regulatory-explain`

- **Controlled substances catalog & history**
  - `GET /controlled-substances/search?q=...`
  - `GET /controlled-substances/history?account_number=...`

> **Note:** For agents that can open documents directly (e.g., DevSupport or
> Regulatory Explainer), the `source_document` path is passed as a `url`
> field *as-is* (e.g. `"/mnt/data/FLORIDA TEST.pdf"`). The runtime transforms
> these local paths into actual URLs, so the agent can fetch the PDF/HTML.

---

## 2. Agent Roles

We define three primary agents:

1. **DevSupport Agent**
2. **Regulatory Explainer Agent**
3. **Form Copilot Agent**

A top-level **Orchestrator / Router** decides which agent to invoke based on
the user’s intent.

### 2.1 DevSupport Agent

Audience: internal developers, QA, SRE, and platform engineers.

Responsibilities:

- Debug failing tests or unexpected decisions in CI.
- Explain why `/csf/.../evaluate` or `/ohio-tddd/evaluate` returned a
  particular status.
- Suggest new test cases based on user scenarios.
- Surface relevant compliance artifacts and controlled-substance history.

Tools:

- HTTP calls to:
  - `/health`
  - `/csf/*/evaluate`, `/csf/explain`
  - `/ohio-tddd/evaluate`, `/ohio-tddd/explain`
  - `/rag/regulatory-explain`
  - `/compliance/artifacts`
  - `/controlled-substances/search`
  - `/controlled-substances/history`
- GitHub / CI logs (via separate tooling like n8n webhooks, not defined here).

Typical flow:

1. User (developer) asks:  
   _“Why is this practitioner CSF for ACC-123 blocked when I add Oxycodone for FL?”_

2. Orchestrator classifies this as **DevSupport**.

3. DevSupport Agent:
   - Calls `/csf/practitioner/evaluate` with the given payload.
   - If status is `blocked` or `manual_review`, calls `/csf/explain`.
   - Calls `/controlled-substances/history?account_number=ACC-123` to see
     recent high-risk items.
   - Optionally calls `/rag/regulatory-explain` with:
     - `decision` = engine decision JSON
     - `regulatory_references` from the decision
     - `question` = “Explain this CSF from a developer perspective.”

4. Agent returns a structured answer:
   - Engine status + reason
   - Key regulatory artifacts used (IDs + names)
   - Any high-risk substances from history
   - Optional RAG-grounded explanation citing which PDF / section was used.

### 2.2 Regulatory Explainer Agent

Audience: compliance, legal, customer support, auditors.

Responsibilities:

- Answer “why” and “what does the rule say” questions.
- Compare rules across forms / states / addendums.
- Provide document-grounded explanations, suitable for audit trails.

Tools:

- `/compliance/artifacts` to map IDs → names → `source_document`.
- RAG endpoint: `/rag/regulatory-explain`
- Direct document access via `source_document` paths (as URLs), e.g.:

  ```json
  {
    "type": "open_document",
    "url": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
  }
  ```

(The runtime transforms the /mnt/data/... path into a real URL.)

Typical flow:

User asks:
“What’s the difference between the practitioner CSF and hospital CSF for Florida Schedule II substances?”

Orchestrator classifies this as Regulatory Explainer.

Regulatory Explainer Agent:

Calls /compliance/artifacts and filters for:

Practitioner CSF form + Florida addendum

Hospital CSF form + Florida addendum

Uses the source_document paths to either:

Call /rag/regulatory-explain with:

question: the user’s question

regulatory_references: artifact IDs from coverage

Or directly open the PDFs/HTML via url=/mnt/data/... for deeper reading.

Agent returns:

A comparative summary.

References to specific artifacts (IDs and human names).

A short “for audit” explanation: where in the document the rule lives.

2.3 Form Copilot Agent

Audience: external users or internal customer-service reps filling forms.

Responsibilities:

Help users complete CSF or Ohio TDDD forms correctly.

Proactively warn about missing required fields.

Suggest the right licensing / controlled substance options based on context.

Tools:

/csf/*/evaluate with partial/incremental payloads.

/csf/explain for “why is it blocked / manual_review”.

/controlled-substances/search for live drug search.

/controlled-substances/history for account-based suggestions.

/ohio-tddd/evaluate and /ohio-tddd/explain for OH flows.

Typical flow:

User says:
“I’m a Florida dental practice and need to add Oxycodone for Schedule II. What do I fill in?”

Orchestrator classifies this as Form Copilot.

Form Copilot Agent:

Asks for key fields (facility type, DEA number, ship_to_state, etc.).

Uses /controlled-substances/search?q=oxycodone to help choose the item.

Builds a draft CSF JSON and calls /csf/practitioner/evaluate.

If result is manual_review, calls /csf/explain and summarises what the
review team will look at.

Optionally calls /rag/regulatory-explain to give a non-technical
explanation tied back to the CSF PDFs.

Returns:

Recommended form values.

Any warnings / missing fields.

Clear explanation of what happens next (e.g., manual review path).

3. Orchestrator / Router Graph (LangGraph-style)

In a LangGraph-style implementation, we would define a small state machine:

Nodes:

ClassifyIntent

Input: user message ( + optional context like “channel = Slack”, “source = CI”).

Output: intent label, one of:

dev_support

regulatory_explainer

form_copilot

other

DevSupportAgentNode

Invokes DevSupport Agent plan:

Backend calls (evaluate/explain/RAG),

Possibly uses coverage + /mnt/data/... docs.

RegulatoryExplainerNode

Invokes Regulatory Explainer Agent:

Uses coverage registry,

RAG calls,

Direct doc access via url=/mnt/data/....

FormCopilotNode

Invokes Form Copilot Agent:

Incremental form filling,

Live controlled-substances search,

Engine and explain loops.

FallbackNode

For other intent; can either politely decline or hand off to a generic
assistant.

Edges:

Start -> ClassifyIntent

ClassifyIntent.dev_support -> DevSupportAgentNode

ClassifyIntent.regulatory_explainer -> RegulatoryExplainerNode

ClassifyIntent.form_copilot -> FormCopilotNode

ClassifyIntent.other -> FallbackNode

Each agent node returns to End with a structured response.

State:

Conversation history (optional).

decision objects from evaluate endpoints.

regulatory_references from decisions.

controlled_substances selections from UI/agents.

References to source_document paths (e.g., /mnt/data/FLORIDA TEST.pdf)
that downstream tools can open using url fields.

4. How /mnt/data/... Paths Are Used by Agents

The artifacts registry is the single source of truth linking IDs to documents:

Each ComplianceArtifact includes a source_document field with a path like:

/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf

/mnt/data/Ohio TDDD.html

Agents use these paths in tool calls as a url field, e.g.:

{
  "tool": "open_document",
  "args": {
    "url": "/mnt/data/Ohio TDDD.html"
  }
}


The runtime environment transforms this local path into a real URL so that:

RAG pipelines can load the PDF/HTML directly.

DevSupport and Regulatory Explainer agents can open the same underlying
documents for summarisation or deeper navigation.

This keeps document locations consistent across:

Backend RAG,

Agents,

Dev/ops tooling,

UI (where source_document can be displayed as “View PDF/HTML”).

5. Implementation Roadmap

The current codebase already supports:

Deterministic engines and explain endpoints.

Coverage registry with source_document paths under /mnt/data/....

RAG endpoint (/rag/regulatory-explain) with stub vs real mode.

Controlled-substances search + history.

Frontend sandboxes (CSF, Ohio, RAG playground, Deep RAG explain).

n8n workflow blueprints.

To introduce a full LangGraph implementation, we can:

Start with DevSupport Agent using only:

HTTP calls to the backend,

RAG endpoint in stub mode,

A simple state machine with ClassifyIntent → DevSupportAgentNode.

Add Regulatory Explainer Agent, wiring:

Coverage registry,

RAG over /mnt/data/... documents.

Add Form Copilot Agent and integrate:

Controlled-substances search/history,

Incremental evaluate/explain loops.

The architecture in this document is designed so that when a LangGraph (or
similar) orchestration layer is added, it can immediately reuse all existing
APIs and documents without changing the core backend.
