# License Compliance Suite – AutoComply AI

The License Compliance Suite in AutoComply AI is a family of sandboxes and APIs that evaluate and explain license requirements for controlled substances and related regulations.

The goals are:

- **Consistent license decision logic** across multiple license variants (starting with Ohio TDDD).
- **Transparent, RAG-based explanations** ("License Copilot") that show _why_ a license is ok to use, needs manual review, or should be blocked.
- **A reusable pattern** so new license engines (other states, national licenses, DEA, etc.) can be added with minimal boilerplate.

For an end-to-end CSF + Ohio TDDD license walkthrough (including inline checks from CSF sandboxes), see [`docs/compliance_journey_csf_license.md`](compliance_journey_csf_license.md).

## Supported License Engines

Each license engine has its own sandbox, API endpoints, and underlying regulatory document in the RAG index.

| Engine | Sandbox Component | Evaluate Endpoint | Copilot Endpoint | RAG Doc ID |
|---------------|--------------------------------|----------------------------------------|------------------------------------------------------|-------------------|
| Ohio TDDD | `frontend/src/components/OhioTdddSandbox.tsx` | `POST /license/ohio-tddd/evaluate` | `POST /license/ohio-tddd/form-copilot` | `ohio_tddd_rules` |
| NY Pharmacy | _Backend prototype (UI TBD)_ | `POST /license/ny-pharmacy/evaluate` | `POST /license/ny-pharmacy/form-copilot` | `ny_pharmacy_rules` |

Front-end sandboxes are mounted on the **License Overview / Playground** page:

- Component: `frontend/src/pages/LicenseOverviewPage.tsx`
- Route: `/license`
- Direct sandbox route: `/license/ohio-tddd`

## Architecture Overview

At a high level, each license engine follows the same path:

1. **Frontend Sandbox**

   - Implemented as a React component (e.g., `OhioTdddSandbox`).
   - Uses a type-safe domain model (`OhioTdddFormData`, `OhioTdddDecision`, `OhioTdddFormCopilotResponse`) from:

     - `frontend/src/domain/licenseOhioTddd.ts`

   - Uses dedicated API clients:

     - `evaluateOhioTdddLicense` in `frontend/src/api/licenseOhioTdddClient.ts`
     - `callOhioTdddFormCopilot` in `frontend/src/api/licenseOhioTdddCopilotClient.ts`

   - The sandbox provides:

     - A simple form for key fields (TDDD number, facility name, ship-to state, attestation, etc.).
     - An **Evaluate** button that calls the decision API.
     - A **Check & Explain** button that calls the License Copilot API.
     - Panels to display status, reason, missing fields, regulatory references, RAG explanation, and sources.
     - A cURL snippet showing how to call `/license/ohio-tddd/evaluate` directly.

2. **FastAPI License Routes**

   For each engine there is a pair of routes in `backend/src/api/routes/`:

   - `POST /license/ohio-tddd/evaluate`
   - `POST /license/ohio-tddd/form-copilot`

   The Ohio TDDD evaluate route (`license_ohio_tddd.py`) performs a minimal v1 decision:

   - Validates presence of key fields like `tddd_number`.
   - Considers the ship-to state (must be `OH` for a clean "ok_to_ship").
   - Checks whether attestation is accepted.
   - Returns a structured `OhioTdddDecision`.

   The copilot route normalizes the Pydantic model into a generic request:

   - Adds `license_type="ohio_tddd"` and key fields into a dict.
   - Calls the shared helper:

     ```python
     from backend.src.services.license_copilot_service import run_license_copilot

     rag_result = await run_license_copilot(copilot_request)
     ```

   - Maps the `LicenseCopilotResult` back into `OhioTdddFormCopilotResponse`.

3. **Shared License Copilot Service**

   `backend/src/services/license_copilot_service.py` contains:

   - `run_license_copilot(license_request: Dict) -> LicenseCopilotResult`, which:

     - Reads `license_type` (e.g., `"ohio_tddd"`).
     - Chooses the correct `doc_id` for RAG (e.g., `"ohio_tddd_rules"`).
     - Builds a type-specific prompt via:

       - `backend/src/rag/license_copilot_prompt.py` (`build_license_copilot_prompt`).

     - Calls the RAG engine with the prompt + `context_filters={"doc_id": doc_id}`.
     - Maps RAG output into a structured result with:

       - `status`, `reason`, `missing_fields`,
       - `regulatory_references`, `rag_explanation`,
       - `artifacts_used`, `rag_sources`.

4. **RAG Documents & Ingestion**

   The Ohio TDDD regulatory HTML/PDF is registered as a RAG document (e.g., in the compliance artifacts registry):

   - `ohio_tddd_rules` → `/mnt/data/Ohio TDDD.html`

   An ingestion script (shared or dedicated) loads and indexes this document into the vector store. The License Copilot calls filter retrieval with `doc_id="ohio_tddd_rules"`, so explanations only use the Ohio TDDD rules document.

## License Copilot Response Contract

All license Copilot endpoints share a common response pattern (mirroring CSF):

- `status`: `"ok_to_ship" | "needs_review" | "blocked"`
- `reason`: a short, human-readable explanation.
- `missing_fields`: list of missing or inconsistent fields (e.g., `["tddd_number"]`).
- `regulatory_references`: opaque strings referencing sections or paragraphs in the underlying license rules document (e.g., `"ohio_tddd_rules:section_4729"`).
- `rag_explanation`: a longer narrative explanation generated by the RAG engine, designed to be customer- or agent-friendly.
- `artifacts_used`: list of doc IDs or artifact identifiers used in reasoning (e.g., `["ohio_tddd_rules"]`).
- `rag_sources`: structured list of sources (with fields like `id`, `title`, `url`, `snippet`).

The frontend sandbox renders these fields consistently, so UI behavior stays consistent as new license engines are added.

## How to Add a New License Engine

The License Suite is designed so new license engines can be added with a repeatable process.

To add a new engine (e.g., `license_type="ny_pharmacy"`), follow this pattern:

1. **Add a RAG document**

   - Place the rules document (HTML or PDF) in an appropriate folder, e.g.:

     - `data/license/ny/NY Pharmacy Rules.html`

   - Register it in the RAG docs config:

     ```yaml
     - id: ny_pharmacy_rules
       title: "New York Pharmacy License Rules"
       path: "data/license/ny/NY Pharmacy Rules.html"
     ```

   - Add `ny_pharmacy_rules` to your license ingest list and re-run ingestion.

2. **Extend `run_license_copilot` routing**

   - In `backend/src/services/license_copilot_service.py`, map `license_type="ny_pharmacy"` to `doc_id="ny_pharmacy_rules"`:

     ```python
     if license_type == "ohio_tddd":
         doc_id = "ohio_tddd_rules"
     elif license_type == "ny_pharmacy":
         doc_id = "ny_pharmacy_rules"
     else:
         doc_id = "ohio_tddd_rules"  # default/fallback
     ```

3. **Update the prompt builder**

   - In `backend/src/rag/license_copilot_prompt.py`, add a more precise label for the new license type:

     ```python
     if license_type == "ohio_tddd":
         license_label = "Ohio TDDD (Terminal Distributor of Dangerous Drugs) License"
     elif license_type == "ny_pharmacy":
         license_label = "New York Pharmacy License"
     else:
         license_label = f"{license_type} license"
     ```

4. **Create backend domain models and routes**

   - Add Pydantic models in `backend/src/domain/license_ny_pharmacy.py` similar to `license_ohio_tddd.py`.
   - Add routes in `backend/src/api/routes/license_ny_pharmacy.py`:

     - `POST /license/ny-pharmacy/evaluate`
     - `POST /license/ny-pharmacy/form-copilot`

   - Normalize incoming form data into a `license_request` dict with `license_type="ny_pharmacy"` and call `run_license_copilot`.

5. **Frontend domain + API clients**

   - Add `frontend/src/domain/licenseNyPharmacy.ts` with:

     - `NyPharmacyFormData`
     - `NyPharmacyDecision`
     - `NyPharmacyFormCopilotResponse`

   - Add API client wrappers:

     - `frontend/src/api/licenseNyPharmacyClient.ts`
     - `frontend/src/api/licenseNyPharmacyCopilotClient.ts`

   - Wire them to:

     - `/license/ny-pharmacy/evaluate`
     - `/license/ny-pharmacy/form-copilot`

6. **Create a sandbox UI**

   - Add `frontend/src/components/NyPharmacySandbox.tsx` based on `OhioTdddSandbox.tsx`:

     - Form inputs for the new license fields.
     - **Evaluate** and **Check & Explain** buttons.
     - Panels for decision and License Copilot output.
     - A cURL snippet for the evaluate endpoint.
     - Telemetry events, e.g., `license_ny_pharmacy_evaluate_success`.

7. **Add to License Overview page**

   - In `frontend/src/pages/LicenseOverviewPage.tsx`:

     - Add a new `LICENSE_SANDBOXES` entry for `ny_pharmacy`.
     - Render `<NyPharmacySandbox />` for that `id`.

8. **Tests & docs**

   - Add backend tests for the new endpoints (evaluate + form-copilot).
   - Add frontend tests for the sandbox component.
   - Update `docs/license_suite_overview.md` and `docs/devsupport_codex_commands.md` with the new engine.

