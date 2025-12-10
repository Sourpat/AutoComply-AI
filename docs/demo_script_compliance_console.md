# AutoComply AI – Compliance Console Demo Script

This document is a **ready-to-use walkthrough** for presenting the AutoComply AI Compliance Console in:

- Portfolio reviews
- Product / engineering interviews
- Internal demos and onboarding

It assumes the frontend and backend are running and the **Compliance Console** page is reachable.

---

## 1. 30–60 second elevator pitch

> “AutoComply AI is a developer-friendly compliance lab for regulated e-commerce.  
> It exposes controlled substance form (CSF) engines, license evaluators, and mock order journeys through a modern console UI, backed by FastAPI and a small AI/RAG explainability layer.  
> It’s designed to show how a real platform could make compliance decisions transparent to business users, engineers, and AI tools.”

Key points to hit:

- **Domain**: controlled substances + state licenses in e-commerce.
- **Tech**: FastAPI backend, Vite + React + TypeScript frontend.
- **Focus**: explainable decisions, good DX (Copy-as-cURL, traces, tests surfaced), and AI/RAG insights.
- It’s not just a form lab: every decision is tied to a trace id, so you get a per-trace case summary, tenant-aware operations
  view, and a recent decisions feed — all hooked into a regulatory knowledge brain.

---

## 2. Quick 3–5 minute live demo flow

This is the “short version” when you don’t have much time.

### Step 1 – Show the console header and tour

1. Open the **Compliance Console** page.  
2. Point out:
   - The **title and description** explain this is a compliance lab on top of decision engines.
   - The **AI / RAG debug toggle** in the top-right.
   - The **“How to explore this console”** tour card summarising the main sections.

Script example:

> “The console is organized the way a compliance stakeholder would actually explore the system:
> start with CSF engines, then licenses, then end-to-end mock orders, and finally health and tests.
> There’s also an AI/RAG debug toggle when we want to look under the hood.”

#### Observability & tenant context (30–45 seconds)

- Point to the **Operational Overview** card:
  - Show that it resolves the current tenant via the `x-autocomply-tenant-id` header (or `demo-tenant` by default).
  - Show the backend health chip and how it stays green ("ok") while you run flows.
- Move to the **Recent Decisions** panel:
  - Run a CSF + license flow and show a new trace appearing.
  - Click a trace row and call out that this pivots the entire console (insights, case summary, ops) to that specific trace.
- Finally, open the **Compliance Case Summary** panel:
  - Explain that this is a per-trace roll-up of CSF, license, and order decisions, plus regulatory references and RAG sources.

### Step 2 – One CSF sandbox with Form Copilot

1. Scroll to the **CSF sandboxes** and choose one (e.g., **Hospital CSF**).  
2. Fill in or tweak a form and click **Evaluate**.  
3. Highlight:
   - The **DecisionStatusBadge** (ok_to_ship / needs_review / blocked).  
   - The mention of which endpoint is called (e.g. `/csf/hospital/evaluate`).  
   - The **TestCoverageNote** pointing to the pytest file (e.g. `backend/tests/test_csf_hospital_api.py`).  
4. Click **Form Copilot** and show the **Regulatory Insights** panel:
   - Missing fields  
   - Regulatory references  
   - RAG explanation  
   - Sources (if present)

Script example:

> “Here’s a Hospital CSF. The decision engine returns a structured outcome, and the Form Copilot layer explains *why* – including missing fields and which internal regulatory rules were consulted.”

### Step 3 – License engines with scenario presets

1. Scroll to **License engines**.  
2. On the **Ohio TDDD** card:
   - Use the **Scenario** dropdown (Happy path / Expired / Wrong ship-to state).  
   - Click **Evaluate** and show how the decision and reason change.  
   - Point out that this engine assumes the state board has already issued/renewed the license; here we only evaluate its suitability for ordering.  
3. Repeat briefly on **NY pharmacy** if there’s time.

Script example:

> “These engines mirror what a real platform would do with state licenses: it doesn’t renew licenses itself; it consumes key license details and explains whether a controlled order should proceed.”

### Step 4 – One mock order journey

1. Scroll to the **Mock order journeys** section.  
2. Pick a journey (e.g., **Ohio hospital mock order**).  
3. Run the mock order evaluation and show:
   - The final order decision and explanation.  
   - The **developer trace** JSON (enable AI/RAG debug if needed) so you can show how CSF + license outputs combine.  
   - The reference to the mock order endpoint (e.g. `/orders/mock/ohio-hospital-approval`) and related tests.

Script example:

> “This is what a real order sees: it doesn’t call the CSF engines or license engines directly; it calls a mock order endpoint that orchestrates those decisions and returns a clear go/no-go result.”

### Step 5 – Health, testing & AI/RAG debug

1. Scroll to **System health** and **Testing & reliability**.  
2. Call out:
   - Health endpoints wired into the console.  
   - TestCoverageNote listing key pytest files (CSF, license, orders, health).  
3. Flip **AI / RAG debug** ON and show:
   - Raw Form Copilot payload under a CSF sandbox.  
   - Raw developer trace for a license engine.

Script example:

> “This isn’t just a pretty UI. Health checks and pytest coverage are surfaced directly, and when I need to go deeper, AI/RAG debug mode reveals the raw JSON that drives the Regulatory Insights panels.”

---

## 3. 10–15 minute deep-dive version

Use this flow when the audience is more technical (product + engineering + AI/ML).

### 3.1 Architecture framing (1–2 minutes)

- Backend: **FastAPI**, modular routers for CSF, licenses, mock orders, health.  
- Frontend: **Vite + React + TypeScript**, console built around cards and shared components.  
- AI/RAG: Copilot endpoints and Regulatory Insights wired to a RAG layer (stubbed or extendable).

Optional talking point:

> “The goal here is not just to build an API, but to show how internal compliance engines can be made explainable and reusable – by humans, other services, and AI agents.”

### 3.2 CSF engine details (Hospital / Facility / Practitioner)

- Show how each sandbox has:
  - A form, an evaluate button, and a Copilot button.  
  - A status badge + reason text.  
  - RegulatoryInsightsPanel that surfaces missing fields, references, explanations, and sources.  
- Mention that the underlying CSF engines can share rule sets / documents, but are exposed as separate sandboxes for each entity type.

### 3.3 License engines and presets

- Walk through how Ohio TDDD and NY pharmacy engines:
  - Assume the state has already issued / renewed licenses.  
  - Evaluate them for ordering context.  
  - Offer scenario presets for demo and testing.  
- Tie back to real-world workflows: board portals vs. internal ordering platforms.

### 3.4 Mock orders and orchestration

- Explain how mock order endpoints represent **orchestration** of:
  - CSF decision + License decision + internal rules.  
- Show how the developer trace and API reference card make it easy to reason about end-to-end behavior.

### 3.5 Deep dive: per-trace case summaries and multi-tenant readiness

- Explain that each decision flow (CSF, Ohio TDDD, NY Pharmacy, orders) emits a trace id and writes to a decision log.
- Show how `/cases/summary/{trace_id}` gives a canonical JSON contract that downstream systems (checkout, n8n, audit tools) can
  consume.
- Mention that a `TenantContext` abstraction reads `x-autocomply-tenant-id`, so logs and summaries can be scoped per health
  system or practice group.
- Emphasize that this is the foundation for:
  - Tenant-scoped dashboards
  - Per-customer audit trails
  - Alerting on risky decisions across tenants.

### 3.6 DX and AI/RAG debug

- Highlight:
  - **Copy-as-cURL** patterns across CSF and License engines.  
  - TestCoverageNote linking UI → pytest.  
  - AI/RAG debug mode for showing raw payloads when talking to engineers or AI/ML leads.

---

## 4. Key phrases to reuse in interviews

You can reuse phrasing like:

- “I built a Compliance Console that exposes controlled substance and license decision engines with explainable outputs, not just yes/no flags.”  
- “Form Copilot and Regulatory Insights panels show missing fields, regulatory references, and natural language explanations that sit on top of the core decision engines.”  
- “There’s a global AI/RAG debug toggle that turns the console into a deep developer/ML debug tool without changing deployments.”  
- “Endpoints are consumable from external tools via Copy-as-cURL, and most sandboxes advertise their backing pytest coverage right in the UI.”
