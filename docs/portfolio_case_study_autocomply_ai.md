# AutoComply AI – Portfolio Case Study

> A mini compliance platform that evaluates controlled substance forms and state licenses, with RAG-based explanations and end-to-end order decisions.

---

## 1. Problem Context

Pharmaceutical and medical distributors need to enforce complex compliance rules before shipping controlled substances:

- Different **customer types** (hospitals, facilities, practitioners, EMS, researchers).
- Different **forms** and regulatory templates (Controlled Substance Forms, CSF).
- Different **license types** and **state-specific rules** (e.g., Ohio TDDD).
- The need for **explainable decisions** for customers, support agents, and compliance teams.

In real systems, this logic is typically scattered across:

- Legacy forms and PDFs.
- Ad hoc business rules in backends.
- Manual review processes.

The result is friction, inconsistent decisions, and difficulty explaining *why* an order was approved, blocked, or sent to review.

---

## 2. Solution Overview

AutoComply AI is a focused prototype of a **compliance decision platform** that:

1. **Standardizes Controlled Substance Form (CSF) decisions**

   - CSF sandboxes for:
     - Hospital
     - Facility
     - Practitioner
     - EMS
     - Researcher
   - Each has:
     - A form to capture CSF data.
     - An evaluation endpoint (`/csf/{type}/evaluate`) returning:
       - `status` (`ok_to_ship`, `needs_review`, `blocked`)
       - `reason`
       - `missing_fields`.

2. **Standardizes license evaluations (starting with Ohio TDDD)**

   - License Suite with:
     - Ohio TDDD sandbox (`/license/ohio-tddd`).
     - Evaluation endpoint:
       - `POST /license/ohio-tddd/evaluate`
     - License Copilot endpoint:
       - `POST /license/ohio-tddd/form-copilot`
   - Shared License Copilot service:
     - Uses RAG over `ohio_tddd_rules`.
     - Returns `status`, `reason`, `missing_fields`,
       `regulatory_references`, `rag_explanation`, `artifacts_used`, `rag_sources`.

3. **Combines CSF + License into a single order-level decision**

   - Mock order endpoint:
     - `POST /orders/mock/ohio-hospital-approval`
   - Input:
     - `hospital_csf`: Hospital CSF payload.
     - `ohio_tddd` (optional): Ohio TDDD payload.
   - Output:
     - `csf_status`, `csf_reason`, `csf_missing_fields`
     - `tddd_status`, `tddd_reason`, `tddd_missing_fields`
     - `final_decision`
     - `notes[]` explaining how the final decision was derived.

4. **Provides explainable UIs and developer tools**

   - CSF sandboxes and License Playground (Vite/React).
   - Ohio Hospital Order Journey card with:
     - Buttons for different scenarios.
     - Final decision + notes.
     - A **developer trace panel** showing raw request + response JSON.
   - Scenario tests + docs that encode the same flows for developers.

---

## 3. Architecture at a Glance

- **Frontend**
  - Vite + React + TypeScript.
  - Sandboxes:
    - `HospitalCsfSandbox`, `FacilityCsfSandbox`, `PractitionerCsfSandbox`, etc.
    - `OhioTdddSandbox`.
  - License Overview / Playground page:
    - `/license` (+ direct `/license/ohio-tddd`).
  - Ohio Hospital Order Journey card:
    - Calls `/orders/mock/ohio-hospital-approval`.
    - Renders UI + developer trace.

- **Backend**
  - FastAPI (Python).
  - CSF routes:
    - `/csf/hospital/evaluate`
    - `/csf/hospital/form-copilot`
    - ...similar for facility, practitioner, EMS, researcher.
  - License routes:
    - `/license/ohio-tddd/evaluate`
    - `/license/ohio-tddd/form-copilot`
  - Mock order route:
    - `/orders/mock/ohio-hospital-approval`
    - Orchestrates CSF + Ohio TDDD into `final_decision`.

- **AI / RAG**
  - LangChain / LangGraph style patterns inside the backend.
  - Shared helpers:
    - `run_csf_copilot` – CSF RAG engine for form explanations.
    - `run_license_copilot` – License RAG engine for Ohio TDDD explanations.
  - Vectorized regulatory docs:
    - CSF forms (hospital, facility, practitioner, EMS, researcher).
    - `ohio_tddd_rules`.

- **Hosting / Automation (conceptual)**
  - Backend on Render (FastAPI APIs).
  - Frontend on Vercel (React UI).
  - n8n for future automation (health checks, re-ingestion, alerts).

For more detail, see:

- `docs/csf_suite_overview.md`
- `docs/license_suite_overview.md`
- `docs/compliance_journey_csf_license.md`

---

## 4. Key Scenarios Implemented

The project encodes realistic compliance scenarios end-to-end as both tests and UI buttons.

### 4.1 Ohio Hospital – Everything Valid (Happy Path)

- Hospital in Ohio ordering a **Schedule II** controlled substance.
- CSF is filled correctly.
- Ohio TDDD license is present and valid.

**Flow**

1. CSF:
   - `POST /csf/hospital/evaluate` → `ok_to_ship`.
   - `POST /csf/hospital/form-copilot` → RAG explanation grounded in hospital CSF form doc.

2. License:
   - `POST /license/ohio-tddd/evaluate` → `ok_to_ship`.
   - `POST /license/ohio-tddd/form-copilot` → explanation grounded in `ohio_tddd_rules`.

3. Mock order:
   - `POST /orders/mock/ohio-hospital-approval`
   - Returns:
     - `csf_status = ok_to_ship`
     - `tddd_status = ok_to_ship`
     - `final_decision = ok_to_ship`
     - `notes[]` summarizing each decision and the final outcome.

**Where this is encoded**

- Tests:
  - `tests/test_scenario_ohio_hospital_schedule_ii.py`
  - `tests/test_order_mock_approval_api.py`
- UI:
  - Ohio Hospital Order Journey → **“Run happy path (everything valid)”** button.

---

### 4.2 Ohio Hospital – CSF OK, TDDD Missing (Negative Path)

- Same Ohio hospital + Schedule II drug.
- CSF is still valid.
- Ohio TDDD payload is missing the TDDD number.

**Flow**

1. CSF:
   - Evaluation still returns `ok_to_ship`.

2. License:
   - `POST /license/ohio-tddd/evaluate` → `needs_review` or `blocked`.
   - Missing TDDD number appears in `missing_fields`.

3. Mock order:
   - `final_decision != ok_to_ship` (conservative: `needs_review` or `blocked`).

**Where this is encoded**

- Tests:
  - Negative scenario in `tests/test_scenario_ohio_hospital_schedule_ii.py`.
  - Negative mock order test in `tests/test_order_mock_approval_api.py`.
- UI:
  - Ohio Hospital Order Journey → **“Run negative path (missing TDDD)”** button.

---

### 4.3 Non-Ohio Hospital – CSF Only (No TDDD)

- Hospital ships to a non-Ohio state (e.g. Pennsylvania).
- CSF is valid.
- No Ohio TDDD payload is sent at all.

**Flow**

1. CSF:
   - `POST /csf/hospital/evaluate` → `ok_to_ship`.

2. License:
   - Skipped by mock order endpoint (no TDDD payload).

3. Mock order:
   - `final_decision = ok_to_ship`
   - Notes include a message that license evaluation was skipped.

**Where this is encoded**

- Tests:
  - `test_mock_order_non_ohio_hospital_no_tddd_still_ok_to_ship`
    in `tests/test_order_mock_approval_api.py`.
- UI:
  - Ohio Hospital Order Journey → **“Run non-Ohio hospital (no TDDD)”** button.

---

## 5. My Role and Key Decisions

This project is intentionally structured the way I would approach a compliance feature in a real e-commerce or healthcare platform.

**My role**

- Product + technical owner of the entire AutoComply AI prototype:
  - Defined the **use cases** (CSF + license + order decision).
  - Designed the **API contracts** and **frontend flows**.
  - Implemented the **FastAPI backend**, **RAG integration**, and **React sandboxes**.
  - Wrote scenario tests and documentation to make the system explainable.

**Key design decisions**

1. **Suite-based architecture**
   - Split into **CSF Suite** and **License Suite**, each with:
     - Their own sandboxes, endpoints, and docs.
   - Makes it easy to add new forms or license types.

2. **Shared copilot contracts**
   - Both CSF and License copilots return the same shape:
     - `status`, `reason`, `missing_fields`,
       `regulatory_references`, `rag_explanation`,
       `artifacts_used`, `rag_sources`.
   - Keeps UI and downstream consumers simple.

3. **RAG isolation per domain**
   - CSF copilots use CSF form docs.
   - License copilots use license-specific docs (e.g. `ohio_tddd_rules`).
   - Avoids mixing regulatory contexts inside a single RAG query.

4. **Mock order endpoint as orchestration**
   - Instead of building a full order system, I added a focused orchestration:
     - `/orders/mock/ohio-hospital-approval`.
   - This demonstrates how multiple engines combine into one decision without adding unrelated complexity.

5. **Scenario tests + UI journey**
   - Every key scenario is:
     - Encoded as a backend **pytest**.
     - Exposed as a **button** in the frontend journey card.
   - This ensures alignment between backend behavior and what users see in the UI.

6. **Developer trace built into the UI**
   - The journey card includes a “Show developer trace” toggle:
     - Pretty-prints the last request + response.
   - This is the kind of design I prefer for AI systems: always show **what we sent and what we got back**, so debugging and governance are easier.

---

## 6. What’s Next

If this were extended further in a production setting, natural next steps would be:

- Add more license engines (e.g., NY Pharmacy, DEA).
- Make license engines **config-driven** (license type → doc id, rules, prompts).
- Integrate with real order and customer data instead of mock payloads.
- Add more complex policy enforcement rules (e.g., thresholds by schedule/quantity).
- Build alerting/automation around high-risk orders (e.g., via n8n or event-driven workflows).

For portfolio purposes, this prototype is enough to show:

- End-to-end design thinking (problem → solution → architecture → scenarios).
- Hands-on implementation across backend, AI/RAG, and frontend.
- A realistic domain (controlled substances + licensing) rather than a toy example.

