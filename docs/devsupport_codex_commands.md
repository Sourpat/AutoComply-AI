# AutoComply AI – DevSupport & `CODEX_COMMAND` Log Catalog

AutoComply AI emits structured console logs prefixed with
`CODEX_COMMAND:`. These logs are designed so that:

- A **DevSupport AI agent** (or any log consumer) can read them,
- Understand exactly **what UI action happened**,
- And re-create or deepen the analysis using tools:
  - HTTP calls to the backend,
  - RAG over regulatory documents,
  - Direct access to uploaded files via `/mnt/data/...` paths.

This document lists the current `CODEX_COMMAND` names, their payloads, and
how they should be interpreted.

---

## 1. General Logging Pattern

All commands follow this basic pattern:

```ts
console.log("CODEX_COMMAND: <command_name>", {
  // structured JSON payload
  // e.g. form, decision, explanation, controlled_substances, source_document
});
```

An external DevSupport agent can:

- Parse logs looking for lines that start with CODEX_COMMAND:.
- Use <command_name> to decide which workflow to run.
- Use the JSON payload to:
  - Reconstruct form submissions,
  - Re-call /csf/.../evaluate or /ohio-tddd/evaluate,
  - Call /csf/explain or /ohio-tddd/explain,
  - Call /rag/regulatory-explain,
  - Open source documents using url fields that point to /mnt/data/....

Important: When a command includes a source_document or url such as
"/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
you should pass that local path as the url directly to your tools.
The runtime will transform this local path into a real URL.

Example tool call (pseudocode):

```json
{
  "tool": "open_document",
  "args": {
    "url": "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
  }
}
```

### CSF Overview / Playground Page

The CSF Overview page provides a single entry point to all CSF sandboxes (Hospital, Practitioner, Facility, EMS, Researcher), including their evaluate / form-copilot endpoints and RAG doc IDs.

Key file:

- `frontend/src/pages/CsfOverviewPage.tsx`

Route:

- `/csf`

Use this page for demos and for quickly verifying that all CSF types are wired correctly.

Codex command:

- `csf_overview_fix_layout` – Update layout/copy of the CSF Overview page.

## 2. CSF Decision & Explain Commands

These commands are emitted from the CSF sandboxes (Practitioner, Hospital,
Researcher, Surgery Center, EMS).

### 2.1 Practitioner CSF

```ts
console.log("CODEX_COMMAND: explain_csf_practitioner_decision", {
  form,
  decision,
  explanation,
  controlled_substances: controlledSubstances,
  source_document:
    "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
});
```

Intent: Explain a practitioner CSF decision with full context.

Payload:

- form: JSON submitted to /csf/practitioner/evaluate.
- decision: Engine result from the evaluate API.
- explanation: Optional csf/explain text, if already retrieved.
- controlled_substances: List of selected controlled substances from the
  Controlled Substances panel.
- source_document: Main practitioner CSF PDF under /mnt/data/....

Recommended DevSupport agent flow:

- If needed, re-call /csf/practitioner/evaluate with form.
- Call /csf/explain with decision.
- Optionally call /rag/regulatory-explain using:
  - decision,
  - regulatory_references from the decision,
  - source_document as a url to load the PDF.

### 2.2 Hospital CSF

```ts
console.log("CODEX_COMMAND: explain_csf_hospital_decision", {
  form,
  decision,
  explanation,
  controlled_substances: controlledSubstances,
  source_document:
    "/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
});
```

Same structure and intent as Practitioner, but for:

- Endpoint: /csf/hospital/evaluate
- Source doc: Hospital Pharmacy CSF PDF.

### 2.3 Researcher CSF

```ts
console.log("CODEX_COMMAND: explain_csf_researcher_decision", {
  form,
  decision,
  explanation,
  controlled_substances: controlledSubstances,
  source_document:
    "/mnt/data/Online Controlled Substance Form - Researcher form.pdf",
});
```

Source doc is the Researcher CSF PDF.

### 2.4 Surgery Center CSF

```ts
console.log("CODEX_COMMAND: explain_csf_surgery_center_decision", {
  form,
  decision,
  explanation,
  controlled_substances: controlledSubstances,
  source_document:
    "/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf",
});
```

Source doc is the Surgery Center CSF PDF.

### 2.5 EMS CSF

```ts
console.log("CODEX_COMMAND: explain_csf_ems_decision", {
  form,
  decision,
  explanation,
  controlled_substances: controlledSubstances,
  source_document: "/mnt/data/Online Controlled Substance Form - EMS form.pdf",
});
```

Source doc is the EMS CSF PDF.

### 2.6 Facility CSF Sandbox

The Facility CSF Sandbox lets you test and debug the Facility Controlled Substance Form flows using the same backend decision/RAG engine as the Hospital CSF Sandbox, but with Facility-specific UI, payload shape, and copy.

Key files:

- **Frontend**
  - `frontend/src/components/FacilityCsfSandbox.tsx`  
    Main Facility CSF sandbox UI (form, evaluate, copilot, RAG explanation).
  - `frontend/src/domain/csfFacility.ts`  
    Facility CSF types: `FacilityCsfFormData`, `FacilityCsfDecision`, `FacilityFormCopilotResponse`, and related RAG source types.
  - `frontend/src/api/csfFacilityClient.ts`  
    Client for `POST /csf/facility/evaluate`.
  - `frontend/src/api/csfFacilityCopilotClient.ts`  
    Client for `POST /csf/facility/form-copilot`.

- **Backend**
  - `backend/src/api/routes/csf_facility.py`  
    FastAPI router for Facility CSF evaluate + form-copilot endpoints.
  - `backend/src/autocomply/domain/csf_copilot.py`  
    Shared CSF Copilot RAG helper (`run_csf_copilot`).
  - `backend/src/rag/csf_copilot_prompt.py`  
    Builds the CSF Copilot prompt based on `csf_type` (e.g., `"facility"` vs `"hospital"`).

Endpoints:

- `POST /csf/facility/evaluate`
- `POST /csf/facility/form-copilot`

#### Command: `csf_facility_fix_copilot_failure`

**When to use**

Use this when the Facility CSF Form Copilot (the “Check & Explain” button in the Facility CSF Sandbox) is:

- Returning errors (non-200 responses),
- Returning an empty or obviously broken payload, or
- Not showing the RAG explanation / regulatory references in the UI.

**What Codex should do**

1. **Check frontend API client wiring**

   - Open `frontend/src/api/csfFacilityCopilotClient.ts`.
   - Confirm that it:
     - Uses the shared `API_BASE` (same as Hospital).
     - Calls `POST /csf/facility/form-copilot`.
     - Parses JSON into `FacilityFormCopilotResponse`.
     - Throws a helpful error message:  
       `"Facility Form Copilot failed with status ${message}"`.

2. **Check Facility sandbox handler + state**

   - Open `frontend/src/components/FacilityCsfSandbox.tsx`.
   - Verify:
     - There is a handler that calls `callFacilityFormCopilot(form)` when the “Check & Explain” button is clicked.
     - It updates `copilotResponse`, `copilotLoading`, and `copilotError` correctly.
     - The UI renders:
       - `status`
       - `reason`
       - `missing_fields`
       - `regulatory_references`
       - `rag_explanation`
       - `rag_sources`
     - All user-facing copy says **“Facility CSF”**, not “Hospital”.

3. **Check backend route + RAG helper**

   - Open `backend/src/api/routes/csf_facility.py`.
   - Confirm `POST /csf/facility/form-copilot`:
     - Accepts `FacilityCsfFormData`.
     - Builds a `copilot_request` with `csf_type="facility"` and all relevant fields (name, facility_type, account_number, license/DEA, ship_to_state, attestation, controlled_substances, internal_notes).
     - Calls `run_csf_copilot(copilot_request)`.
     - Maps the result into `FacilityFormCopilotResponse` (status, reason, missing_fields, regulatory_references, rag_explanation, artifacts_used, rag_sources).

   - Open `backend/src/autocomply/domain/csf_copilot.py`.
     - Confirm `run_csf_copilot`:
       - Reads `csf_type` (`"facility"` vs `"hospital"`).
       - Calls `build_csf_copilot_prompt` from `backend/src/rag/csf_copilot_prompt.py`.
       - Uses the underlying CSF regulatory doc (e.g., `csf_hospital_form`) for retrieval.
       - Returns a structured result that matches the Facility response model.

4. **Run checks**

   - Run backend tests:
     - `cd backend`
     - `pytest`
   - Run frontend typecheck/build:
     - `cd frontend`
     - `pnpm build` (or the project’s standard build command).
   - If any changes were made, ensure both evaluate and copilot still work in the Facility CSF Sandbox.

#### Command: `csf_facility_add_example`

**When to use**

Use this to add a new Facility CSF example (e.g., a long-term care facility, clinic, or multi-location facility) to the Facility CSF Sandbox so users can quickly test realistic scenarios.

**What Codex should do**

1. **Locate Facility examples list**

   - Open `frontend/src/components/FacilityCsfSandbox.tsx`.
   - Find the `FACILITY_EXAMPLES` constant (array of `FacilityCsfFormData`).

2. **Add a new example object**

   - Append a new example entry with:
     - A descriptive `facility_name`.
     - `facility_type: "facility"` (or another valid type if supported).
     - Realistic `account_number`, `pharmacy_license_number`, `dea_number`.
     - A representative `ship_to_state`.
     - `attestation_accepted: true` for a “happy path” example.
     - A non-empty `controlled_substances` list matching what the decision engine expects.

   - Example shape (adjust to match the actual type):

     ```ts
     {
       facilityName: "Example Care Clinic – NJ",
       facilityType: "facility",
       accountNumber: "123456789",
       pharmacyLicenseNumber: "NJ-987654",
       deaNumber: "AB1234567",
       pharmacistInChargeName: "Dr. Example Pharmacist",
       pharmacistContactPhone: "555-555-1212",
       shipToState: "NJ",
       attestationAccepted: true,
       internalNotes: "Example Facility CSF sandbox scenario.",
       controlledSubstances: ["Hydrocodone", "Oxycodone"],
     }
     ```

3. **Ensure the example selector wiring works**

   - Confirm that the example selection UI (dropdown/buttons) in `FacilityCsfSandbox.tsx`:
     - Renders the new example label.
     - Calls `applyFacilityExample(...)` or equivalent handler when selected.

4. **Check telemetry**

   - Keep or update telemetry in `applyFacilityExample`:
     - Event name: `csf_facility_example_selected`.
     - Include fields like:
       - `engine_family: "csf"`
       - `decision_type: "csf_facility"`
       - `sandbox: "facility"`
       - `facility_type`, `ship_to_state`, and any available example identifier.

5. **Run frontend checks**

   - `cd frontend`
   - `pnpm build`
   - Open the Facility CSF Sandbox and verify the new example:
     - Loads the form values correctly.
     - Evaluates and runs Copilot without errors.

## 3. RAG Regulatory Explain Commands

When the user triggers a deep RAG explanation (e.g., from the
Practitioner sandbox or the RAG playground), the UI emits commands like:

### 3.1 Practitioner RAG Explain

```ts
console.log("CODEX_COMMAND: rag_regulatory_explain_practitioner", {
  question,
  regulatory_references: decision.regulatory_references ?? [],
  decision,
  controlled_substances: controlledSubstances,
  source_document:
    "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
});
```

Intent: Ask the RAG pipeline to explain a practitioner decision in a
more narrative, document-grounded way.

Payload:

- question: The user’s free-text question.
- regulatory_references: IDs from the engine decision.
- decision: The full engine decision JSON.
- controlled_substances: Extra context from the Controlled Substances panel.
- source_document: The main CSF PDF path under /mnt/data/....

Agents can call:

- /rag/regulatory-explain with:
  - question,
  - regulatory_references,
  - decision.
- And/or directly load source_document using a tool like open_document.

### 3.2 Other CSF Types

Analogous commands exist for:

- rag_regulatory_explain_hospital
- rag_regulatory_explain_researcher
- rag_regulatory_explain_surgery_center
- rag_regulatory_explain_ems

Each uses the corresponding CSF PDF under /mnt/data/... as
source_document.

### 3.3 RAG example selection

When a user clicks a “Quick example” chip in the RAG playground:

```ts
console.log("CODEX_COMMAND: rag_example_selected", {
  example_id: example.id,
  label: example.label,
  question: example.question,
});
```

Intent: Record that a predefined RAG scenario was chosen.

Payload:

- example_id: Stable ID for the scenario (e.g., "fl_schedule_ii_practitioner").
- label: Human label shown in the UI.
- question: Full question text prefilled into the RAG input.

A DevSupport agent can use example_id to route to a canned workflow
(e.g., also auto-selecting the right regulatory artifacts) or to replay
specific demonstration scenarios.

## 4. Ohio TDDD Commands

The Ohio TDDD sandbox can emit logs such as:

```ts
console.log("CODEX_COMMAND: explain_ohio_tddd_decision", {
  form,
  decision,
  explanation,
  source_document: "/mnt/data/Ohio TDDD.html",
});
```

Intent: Explain an Ohio TDDD decision.

Payload:

- form: JSON submitted to /ohio-tddd/evaluate.
- decision: Engine decision.
- explanation: Optional text returned by /ohio-tddd/explain.
- source_document: The main Ohio TDDD HTML document (under /mnt/data/...).

Agents can:

- Re-call /ohio-tddd/evaluate.
- Call /ohio-tddd/explain.
- Open /mnt/data/Ohio TDDD.html as url and optionally apply RAG.

## 5. Health & Infrastructure Commands

### 5.1 API Health Check

From the API status chip:

```ts
console.log("CODEX_COMMAND: check_api_health", {
  api_base: API_BASE,
  status_after_check: status,
  last_checked_at: new Date().toISOString(),
});
```

Intent: Record that the UI checked backend health.

Payload:

- api_base: The base URL used by the frontend.
- status_after_check: "online" | "offline" | "checking" | "idle".
- last_checked_at: ISO datetime of the check.

A DevSupport agent can:

- Cross-check /health in real time.
- Correlate outages with failed evaluations or RAG calls.

## 6. Source Document Open Commands

From the RAG coverage list and sandbox “View source document” chips:

### 6.1 Coverage Artifacts

```ts
console.log("CODEX_COMMAND: open_regulatory_source_document", {
  artifact_id: artifact.id,
  artifact_name: artifact.name,
  url: artifact.source_document, // example: "/mnt/data/FLORIDA TEST.pdf"
});
```

### 6.2 Sandbox Headers

```ts
console.log("CODEX_COMMAND: open_regulatory_source_document", {
  label: "Practitioner CSF PDF",
  url: "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
});
```

Intent: User clicked a “View document” chip or link.

Payload:

- artifact_id / artifact_name or label (for context).
- url: Always a /mnt/data/... path.

Usage: Pass url directly as the url field to any document-opening tool.
The environment will transform /mnt/data/... into an actual URL.

Example:

```json
{
  "tool": "open_document",
  "args": {
    "url": "/mnt/data/addendums.pdf"
  }
}
```

## 7. How a DevSupport Agent Should Use These Commands

A typical DevSupport workflow over logs:

1. Ingest logs from browser console / log stream.
2. Filter entries that start with CODEX_COMMAND:.
3. Pattern-match command_name:
   - explain_csf_* → form/decision debugging workflow.
   - rag_regulatory_explain_* → RAG debugging workflow.
   - explain_ohio_tddd_decision → Ohio-specific workflow.
   - check_api_health → infra insight.
   - open_regulatory_source_document → document navigation context.
4. Use the payload to:
   - Resubmit forms to /csf/.../evaluate or /ohio-tddd/evaluate.
   - Call /csf/explain or /ohio-tddd/explain.
   - Call /rag/regulatory-explain.
   - Open /mnt/data/... docs via url.
5. Respond with:
   - A grounded explanation (for dev or compliance),
   - Suggested new tests,
   - Or a pointer to the exact PDF/HTML section.

This doc should be kept up to date as new CODEX_COMMAND names are added, so
that any DevSupport or orchestration layer always has a single source of truth
for how to interpret them.

## 8. Regulatory flow diagrams

When a user opens one of the controlled substances flow diagrams:

```ts
emitCodexCommand("open_regulatory_flow_diagram", {
  flow_id: flow.id,
  label: flow.label,
  description: flow.description,
  url: flow.url, // e.g. "/mnt/data/Controlled_Substances_Form_Flow_Updated.png"
});
```

Intent: Record that a specific regulatory flow diagram was opened.

Payload:

- flow_id: Stable ID for the diagram.
- label: Human-friendly label.
- description: Optional explanation of the diagram.
- url: The /mnt/data/... path for the PNG file.

DevSupport agents or n8n workflows should treat url as a standard URL string
and pass it directly into any document/image-opening tools. The runtime will
transform /mnt/data/... into an actual accessible URL.

## 9. CSF Form Copilot (Practitioner & Facility)

The CSF Form Copilot flows emit additional `CODEX_COMMAND` logs so a
DevSupport agent can reconstruct:

- Which sandbox was used (practitioner vs. facility),
- What the engine decision was,
- How the Copilot / RAG pipeline behaved (stub vs. live, success vs. error).

These commands are **separate** from the existing `explain_csf_*` and
`rag_regulatory_explain_*` logs – they are specifically about the
end-to-end “Form Copilot” experience.

### 9.1 Practitioner CSF Form Copilot

#### 9.1.1 Run started

```ts
console.log("CODEX_COMMAND: csf_practitioner_form_copilot_run", {
  engine_family: "csf",
  decision_type: "csf_practitioner",
  sandbox: "practitioner_csf",
  decision_outcome: decision.status ?? "unknown",
  form,                // latest practitioner form payload
});
Intent

Record that the Practitioner Form Copilot was invoked from the
Practitioner CSF sandbox, and capture the engine decision status at the
moment Copilot is launched.

Key fields

engine_family: always "csf".

decision_type: "csf_practitioner".

sandbox: identifies which UI surface triggered the command
(currently "practitioner_csf").

decision_outcome: engine status such as "ok_to_ship",
"blocked", "needs_review", or "unknown" if the status is missing.

form: the practitioner form body that would be sent to
/csf/practitioner/evaluate.

Regulatory doc id: `csf_practitioner_form` (Online Controlled Substance Form –
Practitioner Form with addendums PDF).

DevSupport usage

If you need to replay the decision, POST form back to
/csf/practitioner/evaluate.

Use decision_outcome to route to different debugging workflows
(e.g., blocked vs approved).

9.1.2 Run completed
```ts
console.log("CODEX_COMMAND: csf_practitioner_form_copilot_complete", {
  engine_family: "csf",
  decision_type: "csf_practitioner",
  sandbox: "practitioner_csf",
  decision_outcome: decision.status ?? "unknown",
  artifacts_used: decision.artifacts_used ?? [],
});
```

Intent

Capture how the Practitioner Form Copilot finished and which RAG
artifacts (e.g., `csf_practitioner_form`) were used to ground the
explanation.

Key fields

- Everything from csf_practitioner_form_copilot_run.
- artifacts_used: list of regulatory doc IDs used (e.g.,
  `csf_practitioner_form`, `csf_fl_addendum`).

Key files

- frontend/src/components/PractitionerCsfSandbox.tsx
- frontend/src/domain/csfPractitioner.ts
- frontend/src/api/csfPractitionerClient.ts
- frontend/src/api/csfPractitionerCopilotClient.ts
- backend/src/api/routes/csf_practitioner.py
- backend/src/domain/csf_practitioner.py
- backend/src/autocomply/domain/csf_copilot.py
- backend/src/rag/csf_copilot_prompt.py

9.2 Facility CSF Form Copilot
The facility sandbox mirrors the practitioner flow but uses a different
decision type and command names.

9.2.1 Run started
ts
Copy code
console.log("CODEX_COMMAND: csf_facility_form_copilot_run", {
  engine_family: "csf",
  decision_type: "csf_facility",
  sandbox: "facility_csf",
  decision_outcome: decision.status ?? "unknown",
  form,                // latest facility form payload
});
Intent

Record that the Facility Form Copilot was invoked from the Facility
CSF sandbox.

Key fields

engine_family: "csf".

decision_type: "csf_facility".

sandbox: "facility_csf".

decision_outcome: facility engine outcome at the time of invocation.

form: facility form body that would be sent to /csf/facility/evaluate
(or the appropriate facility evaluate endpoint).

9.2.2 Run completed
ts
Copy code
console.log("CODEX_COMMAND: csf_facility_form_copilot_complete", {
  engine_family: "csf",
  decision_type: "csf_facility",
  sandbox: "facility_csf",
  decision_outcome: decision.status ?? "unknown",
  reason,
  rag_mode,           // "stub" | "live"
  rag_status,         // "ok" | "timeout" | "error"
  question,
  regulatory_references: decision.regulatory_references ?? [],
});
Intent

Summarize the Facility Form Copilot result and RAG behavior.

Key fields & usage

Same semantics as the practitioner *_complete command:

Use decision_outcome + reason to explain what Copilot decided.

Use rag_mode / rag_status to diagnose RAG issues.

Use question + regulatory_references to replay or deepen the RAG
explanation if desired.

Note: If the actual command names in the console differ slightly
(for example: csf_practitioner_form_copilot_run vs
csf_practitioner_copilot_run), this document should be updated to
exactly match the names emitted in the browser logs so DevSupport
agents can pattern-match reliably.

9.3 Hospital CSF Form Copilot
Hospital follows the same pattern as practitioner/facility but targets the
hospital decision engine and RAG prompt.

9.3.1 Run completed
ts
Copy code
console.log("CODEX_COMMAND: csf_hospital_form_copilot_run", {
  engine_family: "csf",
  decision_type: "csf_hospital",
  decision_outcome: decision.status ?? "unknown",
  reason: decision.reason,
  missing_fields: decision.missing_fields ?? [],
  regulatory_references: decision.regulatory_references ?? [],
});
Intent

Capture the hospital Copilot output so DevSupport can correlate the decision
outcome, rationale, and any missing fields or regulatory references surfaced
by the RAG explainer.

Key fields & usage

decision_outcome: the hospital CSF engine result.

reason: human-readable explanation from Copilot (RAG answer or fallback).

missing_fields: any fields the engine flagged as missing.

regulatory_references: artifacts cited by the engine/RAG response.
#
### EMS CSF Sandbox

The EMS CSF Sandbox lets you test EMS Controlled Substance Forms against the same decision/RAG engine, with EMS-specific UI and endpoints.

Key files:

- **Frontend**
  - `frontend/src/components/EmsCsfSandbox.tsx`
  - `frontend/src/domain/csfEms.ts`
  - `frontend/src/api/csfEmsClient.ts`
  - `frontend/src/api/csfEmsCopilotClient.ts`

- **Backend**
  - `backend/src/api/routes/csf_ems.py`
  - `backend/src/autocomply/domain/csf_copilot.py`
  - `backend/src/rag/csf_copilot_prompt.py`

Endpoints:

- `POST /csf/ems/evaluate`
- `POST /csf/ems/form-copilot`

#### Command: `csf_ems_fix_copilot_failure`

**When to use**

Use this when the EMS CSF Form Copilot (the “Check & Explain” button in the EMS CSF Sandbox) is:

- Returning errors (non-200 responses),
- Returning an empty or obviously broken payload, or
- Not showing the RAG explanation / regulatory references in the UI.

**What Codex should do**

1. **Check frontend API client wiring**

   - Open `frontend/src/api/csfEmsCopilotClient.ts`.
   - Confirm that it:
     - Uses the shared `API_BASE` (same as Hospital).
     - Calls `POST /csf/ems/form-copilot`.
     - Parses JSON into `EmsFormCopilotResponse`.
     - Throws a helpful error message:
       `"EMS Form Copilot failed with status ${message}"`.

2. **Check EMS sandbox handler + state**

   - Open `frontend/src/components/EmsCsfSandbox.tsx`.
   - Verify:
     - There is a handler that calls `callEmsFormCopilot(form)` when the “Check & Explain” button is clicked.
     - It updates `copilotResponse`, `copilotLoading`, and `copilotError` correctly.
     - The UI renders:
       - `status`
       - `reason`
       - `missing_fields`
       - `regulatory_references`
       - `rag_explanation`
       - `rag_sources`
     - All user-facing copy says **“EMS CSF”**, not “Facility” or “Hospital”.

3. **Check backend route + RAG helper**

   - Open `backend/src/api/routes/csf_ems.py`.
   - Confirm `POST /csf/ems/form-copilot`:
     - Accepts the EMS CSF payload.
     - Builds a `copilot_request` with `csf_type="ems"` and all relevant fields (name, facility_type, account_number, license/DEA, ship_to_state, attestation, controlled_substances, internal_notes).
     - Calls `run_csf_copilot(copilot_request)`.
     - Maps the result into `EmsFormCopilotResponse` (status, reason, missing_fields, regulatory_references, rag_explanation, artifacts_used, rag_sources).

   - Open `backend/src/autocomply/domain/csf_copilot.py`.
     - Confirm `run_csf_copilot` routes `csf_type="ems"` to the EMS doc id (`csf_ems_form`).
     - Uses the CSF copilot prompt builder to include EMS labeling.

4. **Run checks**

   - Run backend tests:
     - `cd backend`
     - `pytest`
   - Run frontend typecheck/build:
     - `cd frontend`
     - `pnpm build` (or the project’s standard build command).
   - If any changes were made, ensure both evaluate and copilot still work in the EMS CSF Sandbox.

#### Command: `csf_ems_add_example`

**When to use**

Use this to add a new EMS CSF example (e.g., different agency types or jurisdictions) to the EMS CSF Sandbox so users can quickly test realistic scenarios.

**What Codex should do**

1. **Locate EMS examples list**

   - Open `frontend/src/components/EmsCsfSandbox.tsx`.
   - Find the `EMS_EXAMPLES` constant (array of `EmsCsfFormData`).

2. **Add the new example**

   - Add a new entry with realistic data (agency name, facility_type, license, DEA, ship_to_state, attestation, controlled_substances).
   - Keep the label descriptive so users know what the scenario covers (e.g., “Air Medical – Missing Attestation”).
   - Wire the new example into the UI (selector/buttons) and ensure telemetry logs include `example_label` and `ship_to_state`.

### Researcher CSF Sandbox

The Researcher CSF Sandbox lets you test Researcher Controlled Substance Forms against the CSF decision/RAG engine, with Researcher-specific UI and endpoints.

Key files:

- **Frontend**
  - `frontend/src/components/ResearcherCsfSandbox.tsx`
  - `frontend/src/domain/csfResearcher.ts`
  - `frontend/src/api/csfResearcherClient.ts`
  - `frontend/src/api/csfResearcherCopilotClient.ts`

- **Backend**
  - `backend/src/api/routes/csf_researcher.py`
  - `backend/src/autocomply/domain/csf_researcher.py`
  - `backend/src/autocomply/domain/csf_copilot.py`
  - `backend/src/rag/csf_copilot_prompt.py`

Endpoints:

- `POST /csf/researcher/evaluate`
- `POST /csf/researcher/form-copilot`

#### Command: `csf_researcher_fix_copilot_failure`

**When to use**

Use this when the Researcher CSF Form Copilot (the “Check & Explain” button in the Researcher CSF Sandbox) is:

- Returning errors (non-200 responses),
- Returning an empty or obviously broken payload, or
- Not showing the RAG explanation / regulatory references in the UI.

**What Codex should do**

1. **Check frontend API client wiring**

   - Open `frontend/src/api/csfResearcherCopilotClient.ts`.
   - Confirm that it:
     - Uses the shared `API_BASE` (same as Hospital).
     - Calls `POST /csf/researcher/form-copilot`.
     - Parses JSON into `ResearcherFormCopilotResponse`.
     - Throws a helpful error message:
       `"Researcher Form Copilot failed with status ${message}"`.

2. **Check Researcher sandbox handler + state**

   - Open `frontend/src/components/ResearcherCsfSandbox.tsx`.
   - Verify:
     - There is a handler that calls `callResearcherFormCopilot(form)` when the “Check & Explain” button is clicked.
     - It updates `copilotResponse`, `copilotLoading`, and `copilotError` correctly.
     - The UI renders:
       - `status`
       - `reason`
       - `missing_fields`
       - `regulatory_references`
       - `rag_explanation`
       - `rag_sources`
     - All user-facing copy says **“Researcher CSF”**, not “Facility”, “EMS”, or “Hospital”.

3. **Check backend route + RAG helper**

   - Open `backend/src/api/routes/csf_researcher.py`.
   - Confirm `POST /csf/researcher/form-copilot`:
     - Accepts the Researcher CSF payload.
     - Builds a `copilot_request` with `csf_type="researcher"` and all relevant fields (name, facility_type, account_number, license/DEA, ship_to_state, attestation, controlled_substances, internal_notes).
     - Calls `run_csf_copilot(copilot_request)`.
     - Maps the result into `ResearcherFormCopilotResponse` (status, reason, missing_fields, regulatory_references, rag_explanation, artifacts_used, rag_sources).

   - Open `backend/src/autocomply/domain/csf_copilot.py`.
     - Confirm `run_csf_copilot` routes `csf_type="researcher"` to the Researcher doc id (`csf_researcher_form`).
     - Uses the CSF copilot prompt builder to include Researcher labeling.

4. **Run checks**

   - Run backend tests:
     - `cd backend`
     - `pytest`
   - Run frontend typecheck/build:
     - `cd frontend`
     - `pnpm build` (or the project’s standard build command).
   - If any changes were made, ensure both evaluate and copilot still work in the Researcher CSF Sandbox.

#### Command: `csf_researcher_add_example`

**When to use**

Use this to add a new Researcher CSF example (e.g., different lab types or jurisdictions) to the Researcher CSF Sandbox so users can quickly test realistic scenarios.

**What Codex should do**

1. **Locate Researcher examples list**

   - Open `frontend/src/components/ResearcherCsfSandbox.tsx`.
   - Find the `RESEARCHER_EXAMPLES` constant (array of `ResearcherCsfFormData`).

2. **Add the new example**

   - Add a new entry with realistic data (lab name, facility_type, license, DEA, ship_to_state, attestation, controlled_substances).
   - Keep the label descriptive so users know what the scenario covers (e.g., “Research University – Missing Attestation”).
   - Wire the new example into the UI (selector/buttons) and ensure telemetry logs include `example_label` and `ship_to_state`.
