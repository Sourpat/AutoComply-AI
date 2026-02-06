# RAG Explainability RC1 — Release Notes

## What shipped
- Explain v1 contract with canonical normalization and deterministic policy evaluation
- Evidence retrieval with truth gate (no unsupported regulatory claims)
- Evidence coverage + retrieval metrics (coverage, unique sources, latency)
- Knowledge version + KB inventory snapshot endpoint
- Ops smoke checks for determinism and truth-gate enforcement
- Frontend truth-gated rendering with coverage/knowledge telemetry
- RC smoke command that validates backend + KB + frontend wiring

## Why it’s reliable
- Stable submission hash and versioning across policy/knowledge
- Determinism checks in ops smoke (same status + submission_hash)
- Truth gate prevents regulatory claims without citations
- Coverage metrics show evidence completeness transparently

## Demo in 60 seconds
1) Start backend:
   - `cd backend; .venv/Scripts/python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001`
2) Run RC smoke:
   - `powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1`
3) In Console, open demo-sub-3 and click “View details” to see explainability + evidence coverage.

## Key endpoints
- `POST /api/rag/explain/v1`
- `GET /api/ops/smoke`
- `GET /api/ops/kb-stats`
- `GET /api/rag/submissions/recent`
- `POST /api/ops/seed-submissions`

## Known limitations
- Citations may be empty when KB coverage is missing
- No replay/diff UI yet (planned in Phase 3)
- KB inventory is in-memory and not tied to ingestion timestamps yet
