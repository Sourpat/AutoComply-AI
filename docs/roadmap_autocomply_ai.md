# AutoComply AI – Roadmap (conceptual)

This document outlines how AutoComply AI could evolve from a focused
compliance lab into a more complete compliance platform. It is meant to
support portfolio discussions and interviews by showing clear next steps.

---

## Phase 1 – Compliance lab (current state)

What exists today:

- **Engines**
  - Controlled Substance Form (CSF) engines: Hospital, Facility, Practitioner.
  - License engines: Ohio TDDD, NY pharmacy.
  - Mock order journeys: Ohio hospital, Ohio facility, NY pharmacy.
  - Track A: CSF decisions now use a shared DecisionOutcome + RegulatoryReference schema; licenses and orders will adopt the same model next.

- **Console UI**  
  - Modern dark-mode Compliance Console with:
    - CSF sandboxes and Form Copilot.  
    - License engines with scenario presets.  
    - Mock order journeys with scenario badges.  
    - System health and Testing & reliability sections.  
    - Copy-as-cURL patterns and TestCoverageNote callouts.  
    - AI / RAG debug toggle and RegulatoryInsightsPanel components.

- **Backend & tests**  
  - FastAPI backend with routers for CSF, licenses, mock orders, and health.  
  - Pytest coverage for key CSF, license, and mock order endpoints.  
  - HTTP smoke tests and CI wiring.

- **Docs & demos**  
  - README with Compliance Console overview and AI / RAG explainability.  
  - `docs/demo_script_compliance_console.md` – demo script for 3–5 minute and
    10–15 minute walkthroughs.  
  - `docs/integrations_n8n_example.md` – example of orchestrating CSF + license
    + mock orders from n8n.

---

## Phase 2 – Deeper AI / RAG and regulatory coverage

Focus: turn the explainability UI into a truly intelligent layer.

Potential enhancements:

- **Real regulatory corpus**  
  - Ingest DEA guidance, state board rules, and internal policy PDFs into a
    vector store.  
  - Have Form Copilot and license engines pull real citations into
    `regulatory_references` and `rag_sources`.

- **Smarter Form Copilot**  
  - Suggest concrete fixes for missing or conflicting fields (e.g., “license
    class must include X for this schedule”).  
  - Highlight which regulation drove a particular recommendation.

- **Richer traces**  
  - Expand developer traces to show which rules fired, which documents were
    consulted, and how conflicting signals were resolved.

---

## Phase 3 – More engines and production hardening

Focus: broaden coverage and make the platform ready for real traffic.

Potential enhancements:

- **More engines and scenarios**
  - Add more CSF variants (e.g., long-term care, EMS) and license types across
    additional states.  
  - Introduce risk scoring in addition to discrete statuses.

- **Platform features**
  - Authentication, authorization, and tenant-aware decisions.  
  - Audit logs for every decision (who, when, what inputs, what outcome).  
  - Observability: metrics, tracing, and dashboards for engine performance.

- **Deeper integrations**
  - Event-driven hooks (e.g., publish decision events to a message bus).  
  - Stronger examples with n8n, internal order management systems, and
    downstream approval workflows.

---

## Phase 4 – Operationalizing in a real program

Focus: how this kind of platform would map into a real regulated e-commerce
program.

Talking points for interviews:

- Position AutoComply AI as a “decision and explainability layer” that can sit
  between e-commerce frontends and backend ERPs.  
- Highlight how having CSF, license, and order engines in one place makes it
  easier to reason about changes in regulations.  
- Emphasize the combination of:
  - Clear product thinking (console structure, tour, presets, badges).  
  - Engineering practices (tests, health, CI).  
  - AI / RAG explainability (RegulatoryInsightsPanel + debug mode).
