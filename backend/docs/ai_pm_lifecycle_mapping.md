# AutoComply AI × Top 1% AI PM Lifecycle

This document explains how AutoComply AI is built and operated using a
"Top 1% AI-enabled Product Management" lifecycle:

> Discover → Research → Design → Build → Launch → Measure → Iterate

AutoComply AI is not just a UI demo — it is a trace-aware, tenant-aware
compliance brain with real decision contracts, regulatory context, and
end-to-end scenarios for Ohio hospitals and NY pharmacies.

---

## 1) Discover – Real signals from real scenarios

**Goal:** Find meaningful problems and edge cases from realistic flows.

**How AutoComply AI does this:**

- Scenario verticals:
  - Ohio hospital Schedule II flows:
    - `backend/tests/test_scenario_ohio_hospital_schedule_ii.py`
    - `backend/tests/test_scenario_ohio_hospital_vertical_case_summary.py`
  - NY pharmacy license flows:
    - `backend/tests/test_scenario_ny_pharmacy_happy_path.py`
    - `backend/tests/test_scenario_ny_pharmacy_vertical_case_summary.py`
- Frontend sandbox journeys:
  - Hospital CSF presets (happy path, missing DEA, wrong state):
    - `frontend/src/components/HospitalCsfSandbox.tsx`
    - `frontend/src/domain/csfHospitalPresets.ts`
- These flows surface real-world failure modes:
  - Missing DEA → needs_review
  - Wrong ship-to state → blocked
  - Expired / wrong-state licenses in NY and Ohio.

This is how a PM can show that the project starts from realistic
controlled substance workflows, not abstract examples.

---

## 2) Research – Regulatory RAG + domain knowledge

**Goal:** Ground decisions in regulatory evidence, not magic.

**How AutoComply AI does this:**

- RAG-style regulatory search and knowledge:
  - API: `/rag/regulatory/search`
  - Implementation & tests:
    - `backend/src/api/routes/rag_regulatory.py`
    - `backend/tests/test_regulatory_search_api.py`
    - `backend/tests/test_regulatory_knowledge.py`
    - `backend/tests/test_regulatory_knowledge_stub.py`
- CSF / license engines calling into regulatory context:
  - CSF form copilots:
    - `backend/src/api/routes/csf_hospital.py`
    - `backend/src/api/routes/csf_facility.py`
    - `backend/src/api/routes/csf_practitioner.py`
    - `backend/tests/test_csf_*_form_copilot.py`
  - Ohio TDDD & NY Pharmacy RAG sources:
    - `backend/tests/test_license_ohio_tddd_rag_sources.py`
    - `backend/tests/test_license_ny_pharmacy_rag_sources.py`

The system is designed so the PM can say:
> "Every decision can be backed by regulatory snippets and sources, not just a status flag."

---

## 3) Design – Explainable console, presets, and trace-aware UX

**Goal:** Hide complexity from users while keeping decisions explainable.

**How AutoComply AI does this:**

- Compliance Console UX:
  - Main layout:
    - `frontend/src/features/console/ComplianceConsolePage.tsx`
  - Panels:
    - CSF sandboxes (hospital, facility, practitioner)
    - License sandboxes (Ohio TDDD, NY Pharmacy)
    - Mock order journeys
    - AI / RAG debug toggle and JSON traces.
- Explainability components:
  - `RegulatoryInsightsPanel`:
    - `frontend/src/components/RegulatoryInsightsPanel.tsx`
  - `DecisionStatusBadge`, source chips, and RAG debug view.
- Scenario presets:
  - Ohio hospital CSF presets:
    - `frontend/src/domain/csfHospitalPresets.ts`
    - `frontend/src/components/HospitalCsfSandbox.tsx`
  - License presets (Ohio TDDD, NY Pharmacy) in their respective panels.

Design principle: “One click loads a realistic scenario and the console
explains *why* the decision was made.”

---

## 4) Build – Decision contracts, engines, and tests

**Goal:** Implement a robust, test-backed decision engine.

**How AutoComply AI does this:**

- Canonical decision + case summary models:
  - `backend/src/autocomply/domain/decision.py`
  - `backend/src/api/routes/case_summary.py`
  - `backend/tests/test_case_summary_api.py`
- Engines and routers:
  - CSF engines:
    - `backend/src/api/routes/csf_hospital.py`
    - `backend/src/api/routes/csf_facility.py`
    - `backend/src/api/routes/csf_practitioner.py`
  - License engines:
    - `backend/src/api/routes/license_ohio_tddd.py`
    - `backend/src/api/routes/license_ny_pharmacy.py`
  - Mock orders:
    - `backend/src/api/routes/orders_mock.py`
    - `backend/tests/test_orders_mock_api.py`
- CI & smoke:
  - GitHub Actions workflow (backend + frontend + smoke tests).
  - `backend/tests/test_smoke.py` for basic API contracts.

This is where the project shows that it’s backed by real Python models,
FastAPI routers, and a wide pytest suite.

---

## 5) Launch – Demo scripts, cURL affordances, and health checks

**Goal:** Make it easy to show and integrate the product.

**How AutoComply AI does this:**

- Demo script:
  - `backend/docs/demo_script_compliance_console.md`
    - 30–60s pitch
    - 3–5 minute demo flow
    - 10–15 minute deep dive
- Copy-as-cURL in the console:
  - Case summary & decision insights:
    - `frontend/src/features/audit/ComplianceCaseSummaryPanel.tsx`
    - `frontend/src/features/audit/DecisionInsightsPanel.tsx`
  - Regulatory search:
    - `frontend/src/features/rag/RegulatoryKnowledgeExplorerPanel.tsx`
  - Shared button:
    - `frontend/src/components/CopyCurlButton.tsx`
- Health & readiness:
  - `/health` endpoint + tests:
    - `backend/src/api/routes/health.py`
    - `backend/tests/test_health_api.py`

This allows a PM to show:
> "You can go from the UI to Postman/n8n/CI with one click."

---

## 6) Measure – Traces, tenants, and recent decisions

**Goal:** Observe how the compliance brain behaves over time.

**How AutoComply AI does this:**

- Decision traces & log:
  - `backend/src/autocomply/audit/decision_log.py`
  - `backend/tests/test_decision_trace_id.py`
  - `backend/tests/test_decision_audit_trace_api.py`
- Case summaries per trace:
  - `backend/src/api/routes/case_summary.py`
  - `backend/tests/test_case_summary_api.py`
- Multi-tenant context:
  - `backend/src/autocomply/tenancy/context.py`
  - `/tenants/whoami`:
    - `backend/src/api/routes/tenant_debug.py`
    - `backend/tests/test_tenant_whoami_api.py`
- Recent decisions feed:
  - `/decisions/recent`:
    - `backend/src/api/routes/decision_recent.py`
    - `backend/tests/test_decisions_recent_api.py`
  - Frontend panel:
    - `frontend/src/features/audit/RecentDecisionsPanel.tsx`
- Operational overview:
  - `frontend/src/features/ops/OperationalOverviewPanel.tsx`

Together, these features let you answer:
> "What just happened? For which tenant? Which trace? Which engines?"

---

## 7) Iterate – Edge cases, scenarios, and roadmap

**Goal:** Continuously harden the product based on new patterns.

**How AutoComply AI does this:**

- Scenario tests for failure modes:
  - NY Pharmacy:
    - Expired licenses, wrong state, edge flows:
      - `backend/tests/test_scenario_ny_pharmacy_expired_license.py`
      - `backend/tests/test_scenario_ny_pharmacy_wrong_state.py`
      - `backend/tests/test_scenario_ny_pharmacy_flows.py`
  - Ohio Hospital:
    - Expired license, wrong state, Schedule II:
      - `backend/tests/test_scenario_ohio_hospital_expired_license.py`
      - `backend/tests/test_scenario_ohio_hospital_wrong_state.py`
      - `backend/tests/test_scenario_ohio_hospital_schedule_ii.py`
- Roadmap:
  - `backend/docs/roadmap_autocomply_ai.md`
    - Phase 1: Lab
    - Phase 2: Deeper AI/RAG
    - Phase 3: More engines & hardening
    - Phase 4: Operationalization in real programs.

This provides a clear narrative:
- We start with lab scenarios.
- We capture new edge cases as tests.
- We expand coverage and robustness iteratively.

---

## How to talk about this in interviews

In a 1–2 minute summary, you can say:

> "AutoComply AI is a trace-aware, tenant-aware compliance brain for
> controlled substances and licenses. I designed it using a full AI PM
> lifecycle: I started from realistic Ohio and NY pharmacy scenarios
> (Discover), built a regulatory RAG layer (Research), wrapped that in an
> explainable console with scenario presets (Design), implemented engines
> and decision contracts with FastAPI + pytest (Build), added demo scripts
> and copy-as-cURL affordances for integration (Launch), instrumented
> traces, case summaries, tenant context, and recent decisions for
> observability (Measure), and then codified edge cases as scenario tests
> and roadmap items (Iterate)."
