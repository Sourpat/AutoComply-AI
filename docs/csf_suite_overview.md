# Controlled Substance Forms (CSF) Suite – AutoComply AI

The CSF Suite in AutoComply AI is a family of sandboxes and APIs that evaluate and explain Controlled Substance Forms for different customer types. The goal is to provide:

- **Consistent decision logic** across multiple CSF variants (Hospital, Practitioner, Facility, EMS, Researcher).
- **Transparent RAG-based explanations** ("Form Copilot") that explain _why_ a form is ok to ship, needs review, or should be blocked.
- **A reusable pattern** so new CSF types can be added with minimal boilerplate.

## Supported CSF Types

Each CSF type has its own sandbox, API endpoints, and underlying regulatory document in the RAG index.

| Type | Sandbox Component | Evaluate Endpoint | Copilot Endpoint | RAG Doc ID |
|-------------|-------------------------------------------------|-----------------------------------|---------------------------------------------|-------------------------|
| Hospital | `HospitalCsfSandbox.tsx` | `POST /csf/hospital/evaluate` | `POST /csf/hospital/form-copilot` | `csf_hospital_form` |
| Practitioner| `PractitionerCsfSandbox.tsx` | `POST /csf/practitioner/evaluate` | `POST /csf/practitioner/form-copilot` | `csf_practitioner_form` |
| Facility | `FacilityCsfSandbox.tsx` | `POST /csf/facility/evaluate` | `POST /csf/facility/form-copilot` | `csf_facility_form` |
| EMS | `EmsCsfSandbox.tsx` | `POST /csf/ems/evaluate` | `POST /csf/ems/form-copilot` | `csf_ems_form` |
| Researcher | `ResearcherCsfSandbox.tsx` | `POST /csf/researcher/evaluate` | `POST /csf/researcher/form-copilot` | `csf_researcher_form` |

Front-end sandboxes are mounted on the **CSF Overview / Playground** page:

- Component: `frontend/src/pages/CsfOverviewPage.tsx`
- Route: `/csf`

### License Overview / Playground Page

The License Overview page provides a single entry point to license sandboxes, starting with Ohio TDDD.

Key file:

- `frontend/src/pages/LicenseOverviewPage.tsx`

Routes:

- `/license` – overview
- `/license/ohio-tddd` – direct Ohio TDDD sandbox

The Ohio TDDD sandbox uses the shared License Copilot service and the `ohio_tddd_rules` RAG document.

## Architecture Overview

At a high level, each CSF type follows the same path:

1. **Frontend Sandbox**
   - Controlled via a React component (e.g. `HospitalCsfSandbox`, `FacilityCsfSandbox`).
   - Uses a type-safe domain model (e.g. `HospitalCsfFormData`, `FacilityCsfFormData`).
   - Calls:
     - `evaluate{Type}Csf` for decision.
     - `call{Type}FormCopilot` for RAG explanation.
   - Shows:
     - Decision status (`ok_to_ship`, `needs_review`, `blocked`).
     - Reason, missing fields, regulatory references, RAG explanation, sources.
     - cURL snippet for hitting the API directly.

2. **FastAPI CSF Routes**

   For each type there is a pair of routes in `backend/src/api/routes/`:

   - `POST /csf/{type}/evaluate`
   - `POST /csf/{type}/form-copilot`

   The Copilot routes normalize the incoming Pydantic model into a generic `copilot_request` shape and call the shared helper:

   ```python
   from src.autocomply.domain.csf_copilot import run_csf_copilot

   rag_result = await run_csf_copilot(copilot_request)
   ```

3. **Shared CSF Copilot Service**

   `backend/src/autocomply/domain/csf_copilot.py` contains `run_csf_copilot(copilot_request: Dict) -> CsfCopilotResult`, which:

   - Reads `csf_type` (e.g. hospital, practitioner, facility, ems, researcher).
   - Chooses the correct doc_id for RAG (e.g. `csf_facility_form`).
   - Builds a type-specific prompt via `backend/src/rag/csf_copilot_prompt.py` (`build_csf_copilot_prompt`).
   - Calls the RAG engine with the prompt and doc filter.
   - Maps the response into a structured result: `status`, `reason`, `missing_fields`, `regulatory_references`, `rag_explanation`, `artifacts_used`, `rag_sources`.

4. **RAG Documents & Ingestion**

   The CSF regulatory PDFs are registered as RAG documents (e.g. in `backend/src/autocomply/domain/compliance_artifacts.py`). Typical IDs:

   - `csf_hospital_form` → Hospital pharmacy CSF PDF
   - `csf_practitioner_form` → Practitioner CSF PDF (with addendums)
   - `csf_facility_form` → Surgery Center / Facility CSF PDF
   - `csf_ems_form` → EMS CSF PDF
   - `csf_researcher_form` → Researcher CSF PDF

   The ingestion script `backend/scripts/ingest_regulatory_docs.py` loads these PDFs into the vector store. The CSF Copilot calls filter retrieval using `doc_id` so each sandbox only sees its own regulatory doc.

## Decision & Explanation Contract

All CSF types share the same response contract from Form Copilot:

- `status`: `"ok_to_ship" | "needs_review" | "blocked"`
- `reason`: short human-readable explanation.
- `missing_fields`: list of missing or inconsistent fields.
- `regulatory_references`: opaque strings referencing sections or IDs in the underlying CSF docs.
- `rag_explanation`: longer free-text explanation from the RAG engine.
- `artifacts_used`: list of doc IDs or artifact identifiers used in the reasoning (e.g. `["csf_facility_form"]`).
- `rag_sources`: structured list of sources (title, URL, snippet, etc.).

Each sandbox renders these fields consistently, so switching between Hospital, Practitioner, Facility, EMS, and Researcher feels unified from a UI and API perspective.

## How to Add a New CSF Type

The CSF Suite is designed so new CSF variants can be added with a repeatable process. To add a new type (e.g. `csf_dentist`):

1. **Add a RAG document**
   - Place the PDF in `data/csf/dentist/`.
   - Register it in the RAG docs config (e.g. `backend/src/autocomply/domain/compliance_artifacts.py` or your doc registry):

     ```yaml
     - id: csf_dentist_form
       title: "Controlled Substance Form – Dentist"
       path: "data/csf/dentist/Online Controlled Substance Form - Dentist form.pdf"
     ```

   - Add `csf_dentist_form` to the CSF ingest list and re-run `backend/scripts/ingest_regulatory_docs.py`.

2. **Extend `run_csf_copilot` routing**

   - In `backend/src/autocomply/domain/csf_copilot.py`, map `csf_type="dentist"` to `doc_id="csf_dentist_form"`.

3. **Update prompt builder**

   - In `backend/src/rag/csf_copilot_prompt.py`, add:

     ```python
     elif csf_type == "dentist":
         csf_label = "Dentist Controlled Substance Form (Dentist CSF)"
     ```

4. **Create backend domain + routes**

   - Add Pydantic models in `backend/src/autocomply/domain/csf_dentist.py`.
   - Add routes in `backend/src/api/routes/csf_dentist.py`:
     - `POST /csf/dentist/evaluate`
     - `POST /csf/dentist/form-copilot`
   - Normalize the form into a `copilot_request` with `csf_type="dentist"` and call `run_csf_copilot`.

5. **Create frontend domain + API clients**

   - Add `frontend/src/domain/csfDentist.ts` with `DentistCsfFormData`, `DentistCsfDecision`, `DentistFormCopilotResponse`.
   - Add clients:
     - `frontend/src/api/csfDentistClient.ts` → `/csf/dentist/evaluate`
     - `frontend/src/api/csfDentistCopilotClient.ts` → `/csf/dentist/form-copilot`

6. **Create sandbox UI**

   - Add `frontend/src/components/DentistCsfSandbox.tsx`.
   - Mirror the pattern from existing sandboxes:
     - Form state, Evaluate button, “Check & Explain” button.
     - Copilot panel with status, reason, references, RAG explanation, sources.
     - cURL snippet, telemetry events.

7. **Add sandbox to the CSF Overview page**

   - Add a new entry in `frontend/src/pages/CsfOverviewPage.tsx` with endpoints, doc id, and sandbox component.

8. **Tests & docs**

   - Add backend tests for `/csf/dentist/evaluate` and `/csf/dentist/form-copilot`.
   - Add frontend tests for `DentistCsfSandbox`.
   - Update this document and `docs/devsupport_codex_commands.md` with the new CSF type.

## Quick Links

- CSF Overview page: `frontend/src/pages/CsfOverviewPage.tsx`
- CSF sandboxes: `frontend/src/components/*CsfSandbox.tsx`
- CSF domain models: `frontend/src/domain/`
- CSF API clients: `frontend/src/api/`
- CSF routes: `backend/src/api/routes/csf_*.py`
- Copilot service: `backend/src/autocomply/domain/csf_copilot.py`
- Copilot prompt builder: `backend/src/rag/csf_copilot_prompt.py`
- RAG ingestion: `backend/scripts/ingest_regulatory_docs.py`
