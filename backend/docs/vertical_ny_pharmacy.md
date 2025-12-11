# NY Pharmacy Vertical

This vertical shows how AutoComply AI can be applied to a specific regulatory domain: **New York Pharmacy license validation**.

It pairs:

- A dedicated license engine for NY Pharmacy
- RAG-based regulatory sources and explanations
- Scenario tests that cover happy path and edge cases
- A sandbox panel in the Compliance Console for demos

---

## 1. Backend: NY Pharmacy license engine

**Endpoint**

```http
POST /license/ny-pharmacy/evaluate
```

**Input:** NY Pharmacy license details for a specific account / location.

**Output:** Canonical decision object including:

- `status` (`ok_to_ship`, `needs_review`, `blocked`)
- `reason` (human-readable explanation)
- `regulatory_references` (identifiers for NY Pharmacy guidance)
- Optional `risk_level`, `risk_score`
- Optional `rag_sources` (selected snippets used in the explanation)

**Key files**

- Domain logic: `backend/src/domain/license_ny_pharmacy.py`
- Decision builder: `backend/src/autocomply/domain/ny_pharmacy_decision.py`
- API route: `backend/src/api/routes/license_ny_pharmacy.py`
- Tests:
  - `backend/tests/test_license_ny_pharmacy_api.py`
  - `backend/tests/test_license_ny_pharmacy_rag_sources.py`

---

## 2. NY Pharmacy scenarios

The NY Pharmacy vertical includes scenario tests that cover realistic flows:

- `backend/tests/test_scenario_ny_pharmacy_happy_path.py`
  - Valid NY license for the given location.
  - Decision status: `ok_to_ship`.
- `backend/tests/test_scenario_ny_pharmacy_expired_license.py`
  - License is expired.
  - Decision status: `blocked` (high risk).
- `backend/tests/test_scenario_ny_pharmacy_wrong_state.py`
  - License state does not match the ship-to state.
  - Decision status: `blocked` or `needs_review`, depending on rules.

These scenarios ensure that NY Pharmacy behavior is:

- Deterministic
- Backed by tests
- Easy to reference during demos and interviews

---

## 3. RAG and regulatory context

The NY Pharmacy engine integrates with the RAG/regulatory context layer:

- RAG sources tests: `backend/tests/test_license_ny_pharmacy_rag_sources.py`
- Regulatory context tests: `backend/tests/test_regulatory_context_in_verdict.py`

At a high level:

- The engine records which NY Pharmacy documents/sections were used.
- The explanation text builder (`build_explanation_text`) turns that context into a short analyst-style narrative.
- The UI surfaces both the decision and the underlying citations.

---

## 4. Frontend: NY Pharmacy license sandbox

The Compliance Console exposes a dedicated NY Pharmacy panel:

- Component: `frontend/src/components/NyPharmacyLicenseSandbox.tsx`
- Endpoint used: `POST /license/ny-pharmacy/evaluate`

Features:

- Scenario presets:
  - Happy path (valid NY license)
  - Expired license
  - Wrong state
- Status badge (`ok_to_ship` / `needs_review` / `blocked`)
- Analyst-style explanation text
- Regulatory references and RAG sources (when debug is enabled)
- Copy-as-cURL affordance for the underlying API call (if wired)

This panel is the UI entry point for the NY Pharmacy vertical in demos.

---

## 5. Demo narrative

In a live demo, a NY Pharmacy walkthrough might look like:

1. Open the NY Pharmacy License panel in the Compliance Console.
2. Select a preset: happy path vs expired vs wrong state.
3. Click Evaluate to run the NY Pharmacy engine.
4. Show:
   - The decision status and explanation.
   - The regulatory references and sources contributing to the verdict.
5. (Optional) Open the Regulatory Knowledge Explorer to show the underlying NY Pharmacy snippets.
6. (Optional) Show a Case Summary for a trace that includes NY Pharmacy alongside CSF and order decisions.

This vertical demonstrates how AutoComply AI can be pointed at a specific regulatory domain and still reuse the same decision, risk, and explanation semantics as the rest of the platform.
