# End-to-End Compliance Journey – CSF + Ohio TDDD License

This document describes how AutoComply AI combines the **Controlled Substance Forms (CSF) Suite** and the **License Compliance Suite** to handle real-world controlled substance workflows. It walks through a single journey where a Hospital, Facility, or Practitioner submits a CSF, the platform evaluates it, and then performs an inline **Ohio TDDD license check** for Ohio shipments, all backed by explainable, RAG-based copilots. For individual suite overviews, see [`docs/csf_suite_overview.md`](csf_suite_overview.md) and [`docs/license_suite_overview.md`](license_suite_overview.md).

## User Journey Overview

The core compliance journey looks like this:

1. **User prepares a Controlled Substance Form (CSF)**  
   A user (hospital, facility, or practitioner) fills out a CSF with details such as:
   - Customer / facility information  
   - DEA / state license numbers  
   - Ship-to location  
   - Products / controlled substances requested  
   - Compliance attestations

2. **CSF is evaluated in the CSF Sandbox**  
   In AutoComply AI, this is represented by the CSF sandboxes:
   - `HospitalCsfSandbox`
   - `PractitionerCsfSandbox`
   - `FacilityCsfSandbox`
   - `EmsCsfSandbox`
   - `ResearcherCsfSandbox`

   Each sandbox calls its corresponding FastAPI endpoint, for example:

   - `POST /csf/hospital/evaluate`
   - `POST /csf/practitioner/evaluate`
   - `POST /csf/facility/evaluate`

   The engine returns a structured decision:
   - `status`: `ok_to_ship`, `needs_review`, or `blocked`
   - `reason`: a short explanation
   - `missing_fields`: any required fields that are missing or inconsistent

3. **CSF Copilot explains the decision using RAG**  
   The user (or an internal agent) can click **“Check & Explain”** to call the CSF Form Copilot:

   - `POST /csf/{type}/form-copilot`

   Internally, all types share a single `run_csf_copilot` helper that:
   - Chooses the correct CSF regulatory document (`csf_hospital_form`, `csf_practitioner_form`, `csf_facility_form`, etc.).
   - Builds a type-specific prompt.
   - Calls the RAG engine and returns:
     - `status`, `reason`
     - `missing_fields`, `regulatory_references`
     - `rag_explanation`, `artifacts_used`, `rag_sources`

   This gives the user an explainable “why” behind the decision.

4. **Ohio shipments trigger an Ohio TDDD license check**  
   When the **ship-to state is OH**, AutoComply AI can optionally run an inline **Ohio TDDD license check** right from the CSF sandbox:

   - From the **Hospital CSF Sandbox**
   - From the **Facility CSF Sandbox**
   - From the **Practitioner CSF Sandbox**

   Each sandbox has an **“Ohio TDDD License Check (Optional)”** panel, which:

   - Derives an `OhioTdddFormData` payload from the current CSF form.
   - Calls the License Suite endpoint:

     - `POST /license/ohio-tddd/evaluate`

   - Displays a second decision:

     - `status`: `ok_to_ship`, `needs_review`, or `blocked`
     - `reason`
     - `missing_fields`

   This gives a combined view: **CSF decision + Ohio TDDD license decision** on the same screen.

5. **License Copilot explains the license decision (if needed)**  
   For deeper investigation, the user can open the dedicated **Ohio TDDD License Sandbox** (`/license/ohio-tddd`) and run the License Copilot:

   - `POST /license/ohio-tddd/form-copilot`

   The shared `run_license_copilot` helper:

   - Uses `license_type="ohio_tddd"` and the `ohio_tddd_rules` RAG document.
   - Returns the standard copilot contract:
     - `status`, `reason`, `missing_fields`
     - `regulatory_references`, `rag_explanation`
     - `artifacts_used`, `rag_sources`

6. **Agents and customers see the same story**  
   Because both suites share consistent contracts and RAG-based explanations, a support agent, compliance officer, or even an end customer can see:
   - Whether the **form** is acceptable.
   - Whether the **license** is acceptable for a given state.
   - Why those decisions were made, with traceable references to the underlying regulations.

## Journey Diagram – CSF + Ohio TDDD

```mermaid
flowchart LR
    subgraph UI["AutoComply AI UI"]
      H[Hospital / Facility / Practitioner CSF Sandbox]
      L[Ohio TDDD License Sandbox]
    end

    subgraph API["FastAPI"]
      HEval[POST /csf/{type}/evaluate]
      HCopilot[POST /csf/{type}/form-copilot]
      LEval[POST /license/ohio-tddd/evaluate]
      LCopilot[POST /license/ohio-tddd/form-copilot]
    end

    subgraph Engines["Decision & Copilot Engines"]
      CsfEngine[CSF Decision Engine<br/>+ run_csf_copilot]
      LicenseEngine[License Engine<br/>+ run_license_copilot]
    end

    subgraph RAG["RAG + Regulatory Docs"]
      CSFDocs["CSF docs:<br/>csf_hospital_form<br/>csf_practitioner_form<br/>csf_facility_form<br/>csf_ems_form<br/>csf_researcher_form"]
      LicenseDocs["License docs:<br/>ohio_tddd_rules"]
    end

    H -->|Evaluate CSF| HEval --> CsfEngine
    H -->|Check & Explain| HCopilot --> CsfEngine
    H -->|Ohio TDDD license check| LEval --> LicenseEngine

    L -->|Evaluate| LEval
    L -->|Check & Explain| LCopilot --> LicenseEngine

    CsfEngine --> CSFDocs
    LicenseEngine --> LicenseDocs

```

(In the UI, the Hospital / Facility / Practitioner CSF sandboxes can optionally call the Ohio TDDD engine inline whenever ship-to = OH.)

---

## Demo Script – How to Show This in 3–5 Minutes

You can use the following script when demoing AutoComply AI:

1. **Open the CSF Overview page** (`/csf`) and briefly show the different CSF sandboxes.
2. **Open the Hospital CSF Sandbox.**
   - Pick an example with `ship-to state = OH`.
   - Click **Evaluate Hospital CSF** and point out:
     - Status, reason, and any missing fields.
3. **Click “Check & Explain” (CSF Copilot).**
   - Show the RAG explanation and regulatory references from `csf_hospital_form`.
   - Explain that this is grounded in the actual controlled substance form PDFs.
4. **Run the inline “Ohio TDDD License Check”.**
   - Show the second panel with the Ohio TDDD decision.
   - Explain that this is calling `/license/ohio-tddd/evaluate`, using the same form context.
5. **Open the License Overview page** (`/license`) in a new tab.
   - Show the dedicated **Ohio TDDD License Sandbox**.
   - Run **Evaluate** and **Check & Explain** here as well.
   - Point out that this uses the `ohio_tddd_rules` document, via `run_license_copilot`.
6. **Close with the platform story.**
   - CSF Suite standardizes controlled substance form decisions across customer types.
   - License Suite standardizes license validation (starting with Ohio TDDD).
   - Both share:
     - Consistent decision contracts,
     - Shared RAG engine patterns,
     - Sandbox UIs and cURL snippets for developers.
   - New states or license types can be added by following the same patterns.
