# Phase 3 Backlog — RAG Explainability + Agentic Workbench

## Epic 1: Replay + Diff
- Persist ExplainResult runs keyed by submission_hash, policy_version, knowledge_version
- Add compare endpoint and UI diff view (status, fired rules, citations, summary)
- Timeline of explain runs per submission
- Exportable diff packet for audit

## Epic 2: Evidence Governance
- Ingestion pipeline metadata (source, effective dates, jurisdiction, version tags)
- Document de-duplication and chunk lineage
- Approval states for regulatory sources (draft/approved/expired)
- Coverage dashboards by jurisdiction and rule

## Epic 3: Agentic Workbench Tools
- Missing info request generator (typed outputs)
- Doc ingestion request builder with evidence gaps
- Policy change proposal assistant with rule impact summary
- Guardrails: validation + deterministic templates

## Epic 4: Golden Case Suite + CI Gating
- Expand to 50 curated golden cases across jurisdictions
- CI gating for determinism + evidence coverage thresholds
- Regression alerts when coverage drops or truth gate is triggered unexpectedly
