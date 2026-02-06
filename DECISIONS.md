# Architecture Decision Record (ADR)

**Purpose**: Log significant technical decisions made during development to provide context for future changes.

---

## Template (Use for New Decisions)

```markdown
## [YYYY-MM-DD] Decision Title

**Context**: What problem or question prompted this decision?

**Decision**: What did we decide to do?

**Rationale**: Why did we choose this approach?

**Alternatives Considered**:
- Option 1: Why rejected
- Option 2: Why rejected

**Consequences**:
- Positive: Benefits of this decision
- Negative: Tradeoffs or limitations
- Neutral: Other impacts

**Status**: Proposed | Accepted | Superseded

**Related**:
- Commit: abc1234
- Tasks: T-042
- Docs: PHASE_X.md
```

---

## Decisions

### [2026-02-06] Reset settings cache between tests

**Context**: Several tests toggle `APP_ENV` and `DEV_SEED_TOKEN`, but `get_settings()` is cached. This caused environment-dependent endpoints (like `/dev/seed`) to intermittently read stale production settings in CI.

**Decision**: Add an autouse pytest fixture in [backend/tests/conftest.py](backend/tests/conftest.py) that clears `get_settings` cache before and after each test.

**Rationale**:
- Keeps environment overrides reliable without restructuring app initialization
- Eliminates cross-test leakage from cached settings

**Alternatives Considered**:
- Remove caching from `get_settings`: rejected due to broader runtime impact
- Rebuild the FastAPI app per test: rejected due to cost and test complexity

**Consequences**:
- Positive: Stable, deterministic test behavior across env overrides
- Negative: Minor overhead from cache resets per test

**Status**: Accepted

### [2026-02-05] Deterministic knowledge pack mode for evidence retrieval

**Context**: Evidence citations varied across environments because retrieval depended on whatever KB was available at runtime.

**Decision**: Add a small, versioned knowledge pack in-repo and route evidence retrieval to a deterministic pack retriever when `ENV=ci` or `KNOWLEDGE_MODE=pack`. Surface pack counts in ops kb-stats and set `knowledge_version` to `kp-v1` in explain results.

**Rationale**:
- Ensures golden suite and ops smoke are reproducible in CI and local demos
- Removes dependency on external/variable KB contents
- Keeps retrieval deterministic with a simple token overlap scorer

**Alternatives Considered**:
- Pinning external KB data: rejected due to operational coupling
- Disabling evidence in CI entirely: rejected due to losing coverage guarantees

**Consequences**:
- Positive: Stable, environment-independent evidence behavior
- Neutral: Pack must be maintained alongside KB updates

**Status**: Accepted

### [2026-02-05] Explain run retention, compaction, and storage health guardrails

**Context**: Explain runs must remain bounded and storage health needs to be observable to prevent long-run degradation.

**Decision**: Add retention and compaction utilities, a guarded ops maintenance endpoint, and storage health checks in ops smoke with warn/fail thresholds.

**Rationale**:
- Prevents unbounded growth of explain run storage
- Enables manual or scheduled maintenance without blocking explain path
- Surfaces storage risk early in ops checks

**Alternatives Considered**:
- External job/cron only: rejected to keep local ops control

**Consequences**:
- Positive: Operational durability for explain runs
- Neutral: Occasional VACUUM overhead when thresholds are met

**Status**: Accepted

### [2026-02-05] Explain drift detection and ops drift lock

**Context**: Explainability must be stable and any change must be classified and surfaced for auditability.

**Decision**: Add a drift classifier that attributes changes to input, policy, knowledge, or engine versions, and enforce a drift lock in ops smoke that fails on unexpected changes.

**Rationale**:
- Prevents silent behavior changes
- Makes drift attributable for audits and ops

**Alternatives Considered**:
- Only compare run IDs: rejected because it hides causal drift

**Consequences**:
- Positive: Strong stability guarantees for explain replay
- Neutral: Adds drift metadata to diff response

**Status**: Accepted

### [2026-02-05] Strict canonical validation and claim gating for explain v1

**Context**: Explain v1 requires deterministic validation and a guardrail to prevent unsupported claims in summaries, especially before any richer narrative generation is introduced.

**Decision**: Add canonical validation that returns MissingField entries without raising, enforce ExplainResult contract validation at runtime, and gate summaries with a deterministic claim gate that replaces unsafe summaries with safe templates.

**Rationale**:
- Ensures malformed payloads cannot be marked approved
- Enforces contract integrity before responses are returned
- Prevents regulatory claims without supporting evidence

**Alternatives Considered**:
- Add LLM-only moderation: rejected to keep deterministic safeguards
- Skip runtime validation: rejected due to silent contract drift risk

**Consequences**:
- Positive: Stronger reliability wall for explainability responses
- Neutral: Additional validation logic on each request

**Status**: Accepted

### [2026-02-05] Explain run idempotency, correlation IDs, and SQLite hardening

**Context**: Explain v1 runs need to be production-safe under concurrent requests, with traceable request IDs and idempotent deduplication.

**Decision**: Enable SQLite WAL + busy_timeout, serialize writes with a process lock, and add idempotency + request ID metadata to explain run records. Use a deterministic `run_dedupe_key` when `Idempotency-Key` is present to reuse runs.

**Rationale**:
- Avoids write contention errors under concurrent traffic
- Prevents duplicate runs for retry storms
- Provides end-to-end traceability via `X-Request-Id`

**Alternatives Considered**:
- Move to a separate DB: rejected to keep local storage lightweight
- Ignore idempotency: rejected due to retry duplication risk

**Consequences**:
- Positive: Explain runs are reliable and traceable in production-like load
- Neutral: Adds a small amount of metadata to SQLite rows

**Status**: Accepted

### [2026-02-05] Explain run IDs include timestamp for immutable replay

**Context**: Replay/diff auditing requires multiple Explain v1 runs to be stored for the same submission without collisions.

**Decision**: Append a timestamp suffix to the Explain run ID to guarantee uniqueness while preserving the submission hash prefix.

**Rationale**:
- Prevents SQLite primary key collisions when replaying the same submission
- Keeps run IDs human-readable and traceable to a submission hash
- Enables ops smoke replay_diff to compare consecutive runs reliably

**Alternatives Considered**:
- Use UUIDs only: rejected to keep run IDs traceable to submission hash
- Overwrite existing runs: rejected because audit trail must be immutable

**Consequences**:
- Positive: Immutable audit log supports multiple replays per submission
- Neutral: Run IDs are slightly longer due to timestamp suffix

**Status**: Accepted

### [2026-02-05] Deterministic evidence retrieval with truth gate for Explain v1

**Context**: Explain v1 needed to attach regulatory evidence to fired rules without allowing RAG to alter decisions or fabricate citations.

**Decision**: Add a deterministic evidence retriever backed by existing regulatory knowledge search, map rule IDs to fixed query templates, and enforce a truth gate that withholds regulatory claims when no citations are found.

**Rationale**:
- Ensures evidence attachment is reproducible and grounded in existing KB
- Keeps policy engine deterministic and independent from retrieval
- Prevents hallucinated citations by requiring matches or returning empty results

**Alternatives Considered**:
- Use free-form RAG generation: rejected due to hallucination risk
- Add a new vector database: rejected to keep infra unchanged

**Consequences**:
- Positive: Explain v1 now returns citations when available and safe summaries when not
- Neutral: Evidence coverage depends on KB content and query templates

**Status**: Accepted

### [2026-02-04] Explainability Contract v1 with canonical normalization

**Context**: The RAG explainability flow needed a deterministic, backend-first contract to avoid hallucinated decisions and ensure consistent evaluation across payload variants.

**Decision**: Introduce a canonical ExplainResult contract, submission normalizers for csf_practitioner and csf_hospital_ohio, and a deterministic policy engine wired to a new /api/rag/explain/v1 endpoint with explicit versioning.

**Rationale**:
- Guarantees explainability output only depends on canonical payload + rules
- Provides a stable response shape for frontend integration
- Enables future contract evolution via versioned helpers

**Alternatives Considered**:
- Continue using legacy explain debug payloads: rejected due to inconsistent schemas
- Add ad-hoc logic in the endpoint: rejected to keep normalization and evaluation reusable

**Consequences**:
- Positive: Stable contract and deterministic outputs for explainability
- Neutral: Additional versioning metadata added to responses

**Status**: Accepted

### [2026-02-04] RAG Explorer explainability layout + required-field completeness

**Context**: The RAG Explorer View Details page needed a clearer, premium explainability layout and data completeness scoring that does not show 0% when the submission payload is missing.

**Decision**: Refactor the explainability UI into summary cards plus evidence/completeness columns, and compute completeness using a fixed required-field list with explicit empty-state handling when payload data is missing.

**Rationale**:
- Keeps explainability aligned with compliance reviewer expectations
- Prevents misleading 0% completeness when payloads are absent
- Provides consistent decision status/risk cues based on missing BLOCK/REVIEW fields

**Alternatives Considered**:
- Continue rule-expectations scoring: rejected because it can show 0% when payload is missing
- Leave layout unchanged: rejected due to clarity and UX requirements

**Consequences**:
- Positive: Clearer explainability flow and more accurate completeness messaging
- Neutral: Completeness logic is now independent of rule expectation metadata

**Status**: Accepted

### [2026-02-03] Ops smoke endpoint exposed at /api/ops/smoke

**Context**: Local smoke checks needed a stable, unauthenticated endpoint and OpenAPI visibility at `/api/ops/smoke` to mirror production.

**Decision**: Expose the smoke check under `/api/ops/smoke` via an ops router alias with no auth dependencies so it appears in OpenAPI and can be called directly.

**Rationale**:
- Keeps smoke checks decoupled from admin auth
- Preserves a single canonical smoke handler
- Ensures documentation parity with production

**Consequences**:
- Positive: `/api/ops/smoke` is callable without headers and documented
- Neutral: No schema changes

**Status**: Accepted

### [2026-02-03] Demo answers + forced health refresh for Console

**Context**: Console displayed “Backend Not Reachable” even after backend recovery due to cached health checks, and demo questions in Chat were routed to the backend and queued.

**Decision**: Add a force refresh path for backend health checks and wire Console retry actions to clear cache and re-evaluate. Provide a frontend-only demo answer map for demo question clicks to return immediate responses without backend calls.

**Rationale**:
- Allows the Console to recover after backend starts without full reload
- Ensures demo questions always produce immediate, deterministic answers
- Reduces reliance on backend availability for demo UX

**Consequences**:
- Positive: Faster recovery and smoother demo flow
- Negative: Demo answers are curated and must be maintained
- Neutral: No backend schema changes

**Status**: Accepted

### [2026-02-03] Dev proxy includes workflow endpoints

**Context**: Console health checks and case loading hit `/workflow/*` endpoints; without a Vite proxy entry they returned 404 from the dev server.

**Decision**: Add a `/workflow` proxy entry in Vite dev server to forward to the backend.

**Rationale**:
- Keeps workflow health checks and case APIs functional in local dev
- Avoids forcing all workflow calls to `/api/*` when backend exposes `/workflow/*`

**Consequences**:
- Positive: Console no longer reports backend unreachable during local dev
- Neutral: No production behavior changes

**Status**: Accepted

### [2026-02-03] Standardize chat API path + API-only Vite proxy

**Context**: Dev requests to `/api/chat/*` returned 404 in the running API, while `/api/v1/chat/*` worked. Dev server proxying many non-API routes also caused SPA refreshes to hit the backend.

**Decision**: Standardize the frontend chat client on `/api/v1/chat` and narrow the Vite dev proxy to API-only routes (`/api`, `/health`).

**Rationale**:
- Matches the canonical backend routes currently exposed in OpenAPI
- Prevents SPA routes from being proxied to the backend during dev
- Keeps API base control in `VITE_API_BASE_URL`

**Alternatives Considered**:
- Fix `/api/chat` alias routing: deferred until alias registration discrepancy is resolved

**Consequences**:
- Positive: Chat submit works end-to-end and SPA refreshes return index.html
- Negative: `/api/chat/*` is no longer used by the frontend
- Neutral: No backend schema changes

**Status**: Accepted

### [2026-02-03] Review Queue auth header normalization

**Context**: Review Queue requests were returning 403 due to inconsistent role header names and missing dev seed token propagation between frontend and backend.

**Decision**: Define shared header constants (`x-user-role`, `x-autocomply-role`, `x-dev-seed-token`) in backend auth dependencies and frontend auth helpers. Require role headers for Review Queue access and validate the dev seed token when configured, returning clear 403 reasons.

**Rationale**:
- Prevents silent 403s by aligning header names across stack
- Ensures Review Queue access remains protected while supporting dev/staging tokens
- Provides explicit error messaging for faster troubleshooting

**Consequences**:
- Positive: Consistent RBAC headers and clearer failure reasons
- Negative: Requires setting `VITE_DEV_SEED_TOKEN`/`DEV_SEED_TOKEN` when token enforcement is enabled
- Neutral: No schema changes

**Status**: Accepted

### [2026-02-03] Chat API alias + frontend endpoint alignment

**Context**: The Chat page returned a 404 because frontend requests did not match the backend chat route prefix, and there was no health probe for quick smoke checks.

**Decision**: Standardize the frontend on `/api/chat` via the shared `apiFetch` helper, and add backend alias routes for `/api/chat` that proxy to the canonical `/api/v1/chat` handlers, including a `/api/chat/health` endpoint.

**Rationale**:
- Keeps the UI aligned with the prevailing `/api` prefix across the app
- Preserves backward compatibility with `/api/v1/chat`
- Adds a lightweight health check for smoke testing

**Alternatives Considered**:
- Update frontend to `/api/v1/chat` only: rejected to keep `/api` parity and avoid future 404s
- Change backend to `/api/chat` only: rejected to avoid breaking existing clients

**Consequences**:
- Positive: Eliminates chat 404s and improves diagnostics
- Negative: Adds a thin alias surface to maintain
- Neutral: No schema changes

**Status**: Accepted

### [2026-02-03] Diagnostics-first fetch + console analytics summary (Phase 10.5)

**Context**: Review Queue, Ops, and Analytics dashboards had silent failures and inconsistent API bases across prod/local, and analytics lacked a stable summary contract.

**Decision**: Standardize frontend requests through a diagnostics-first `apiFetch` that logs request URL, status, body snippet, and correlation headers on failures; surface error panels in the Review Queue, Ops, and Analytics pages. Add a minimal `/api/console/analytics/summary` endpoint that returns a stable aggregate payload for the Analytics Dashboard.

**Rationale**:
- Reduces time-to-debug by making endpoint failures visible in UI
- Keeps API base consistent without production localhost fallbacks
- Provides a single analytics contract for fast dashboard wiring

**Consequences**:
- Positive: Faster ops/debug loop, fewer silent failures
- Negative: Adds lightweight aggregation queries on summary endpoint
- Neutral: Existing analytics endpoints remain available

**Status**: Accepted

### [2026-02-03] Demo reset guard + ops smoke checks (Phase 10.3)

**Context**: Recruiter demos require safe reset tooling without risking destructive actions in production, plus a single smoke endpoint for deployment checks.

**Decision**: Add `/api/demo/reset` guarded by APP_ENV and `DEV_SEED_TOKEN` header (blocked in prod unless token matches), and `/api/ops/smoke` to report DB, schema, signing, and active-contract readiness. Surface the checks in Console Dashboard with a Demo Ready panel.

**Rationale**:
- Enables reliable demo resets in dev/staging
- Prevents accidental production data clearing
- Provides a single non-destructive readiness endpoint for smoke tests

**Consequences**:
- Positive: Safer demos and clearer operational checks
- Negative: Requires setting `DEV_SEED_TOKEN` when using prod reset override
- Neutral: No schema changes

**Status**: Accepted

### [2026-02-02] Signing status endpoint + prod enforcement (Phase 10.2)

**Context**: Phase 10.2 requires deploy parity for audit signing, a status endpoint, and stricter production behavior when signing is disabled.

**Decision**: Standardize on `AUDIT_SIGNING_KEY`, expose `/api/audit/signing/status` with a fingerprint, show signing status in the Workbench, and enforce a 400 response on `/api/audit/verify` when signing is missing in production.

**Rationale**:
- Prevents silent unsigned verification in production
- Provides a non-sensitive indicator of signing key presence
- Keeps verification behavior transparent for operators

**Consequences**:
- Positive: Clear signing status and stronger production enforcement
- Negative: Requires key configuration for prod verification
- Neutral: No change to packet format

**Status**: Accepted

### [2026-02-02] Signed audit packets + verification workflow (Phase 10.1)

**Context**: Phase 10.1 requires cryptographic integrity for audit packets, a verification endpoint, and signed exports for governance.

**Decision**: Canonicalize audit packet serialization, compute a SHA-256 packet hash, and sign the canonical payload using HMAC-SHA256 with `AUDIT_SIGNING_KEY`. Attach hash + signature to packets and exports, and add `/api/audit/verify` to validate packets server-side.

**Rationale**:
- Ensures tamper-evident audit artifacts
- Enables lightweight integrity checks without external dependencies
- Keeps signing server-side only to protect keys

**Consequences**:
- Positive: Signed exports and verification improve audit trustworthiness
- Negative: Requires signing key configuration in deployments
- Neutral: No changes to decision logic

**Status**: Accepted

### [2026-02-02] Startup migrations + DB health checks (Phase 10.0)

**Context**: Phase 10.0 requires deployment stability by ensuring schema readiness on startup and providing a health endpoint that validates required tables and columns.

**Decision**: Add a consolidated `startup_migrations()` hook that enforces contract, trace, override, and intelligence history schemas at app startup, and introduce `/health/db` to validate required tables/columns. Surface build SHA in `/health/full` to support deployment diagnostics.

**Rationale**:
- Prevents runtime failures due to missing tables/columns
- Provides a lightweight schema readiness signal for deployments
- Keeps migrations idempotent and safe for repeated startups

**Consequences**:
- Positive: Faster diagnosis of schema drift and startup stability
- Negative: Additional startup checks (minimal overhead)
- Neutral: No changes to business logic

**Status**: Accepted

### [2026-02-02] Policy override workflow + governance audit trail (Phase 9.6-9.7)

**Context**: Phase 9.6-9.7 requires a human override workflow with persistence, auditability, and UI controls, plus exportable governance evidence.

**Decision**: Add a policy override table and API to record reviewer overrides per submission/trace, apply overrides at read-time for decision outputs, log a first-class audit timeline event, and include override metadata in audit exports (JSON/PDF).

**Rationale**:
- Keeps the override workflow explicit and auditable
- Ensures review actions are persisted and traceable across sessions
- Provides deterministic precedence in decision rendering

**Precedence Order**:
1. **Policy override (human)**: If an override exists for the trace, it forces decision status.
2. **Policy enforcement**: Safe-failure and policy gates can downgrade auto decisions.
3. **Engine output**: Base decision produced by the domain engine.

**Consequences**:
- Positive: Human governance is durable, visible, and exportable
- Negative: Adds an additional persistence table and audit mapping logic
- Neutral: Does not alter core engine evaluation algorithms

**Status**: Accepted

### [2026-02-02] Override RBAC + append-only analytics (Phase 9.8-9.9)

**Context**: Phase 9.8-9.9 requires hardening override workflow access and adding analytics for governance oversight.

**Decision**: Enforce override RBAC server-side (roles: verifier, devsupport, admin), require rationale length validation, and keep overrides append-only (new rows per override). Add metrics endpoint to summarize overrides within a time window.

**Rationale**:
- Prevents unauthorized override actions
- Preserves immutable audit trail
- Enables governance reporting without modifying historical records

**Consequences**:
- Positive: Stronger access controls and auditability
- Negative: Requires role propagation in clients
- Neutral: No change to policy evaluation logic

**Status**: Accepted

### [2026-02-02] Add safe failure modes for policy overrides (Phase 9.5)

**Context**: Recruiter demos need explicit, auditable explanations when AI wants to auto-decide but policy blocks/escalates.

**Decision**: Introduce safe failure models in the policy engine, attach them to decisions, expose read-only safe-failure endpoints, and surface Policy Override context in Workbench and the audit timeline.

**Rationale**:
- Keeps policy contract schema intact while making overrides explicit
- Provides recruiter-friendly explanations without changing decision behavior
- Adds minimal UI badges/panels for visibility

**Consequences**:
- Positive: Clear, auditable reasons for policy overrides
- Negative: Additional model + API mapping to maintain
- Neutral: No changes to deployment configuration

**Status**: Accepted

### [2026-02-02] Surface policy drift in audit + Workbench

**Context**: Phase 9.4 requires highlighting when historical decisions were made under a different AI decision contract than the current active contract.

**Decision**: Persist `contract_version_used` per decision audit entry, compute drift against the active contract in audit/trace APIs, and surface a Policy Drift badge in Workbench and the decision audit timeline.

**Rationale**:
- Keeps decision records immutable while providing current-policy context
- Avoids schema changes by computing drift at read time
- Minimal UI update for demo clarity

**Consequences**:
- Positive: Clear drift visibility for auditors and demos
- Negative: Additional API mapping logic for audit endpoints
- Neutral: No change to decision logic or persistence layer

**Status**: Accepted

### [2026-02-02] Add Workbench case endpoint fallback + API aliases

**Context**: Agentic Workbench cases were not loading reliably due to inconsistent API route prefixes across console/workflow/agentic endpoints.

**Decision**: Add frontend fallback to try /api/workflow/cases, /api/agentic/cases, and /api/console/work-queue in order, and add backend alias routes for /api/workflow/cases and /api/console/work-queue.

**Rationale**:
- Avoids breaking existing routes while improving resilience
- Keeps changes additive with no schema updates
- Aligns Workbench with existing workflow and console sources

**Consequences**:
- Positive: Workbench can load cases across deployments with differing route prefixes
- Negative: Additional mapping logic in the Workbench loader
- Neutral: Existing endpoints remain unchanged

**Status**: Accepted

### [2026-02-01] Add read-time execution preview (Phase 8.1)

**Context**: Phase 8.1 requires a read-only SDX execution preview derived from existing audit packet signals without changing decision logic.

**Decision**: Compute `execution_preview` at read-time only when FEATURE_EXEC_PREVIEW is enabled; never persist, and default unknown-safe when signals are missing.

**Rationale**:
- Preserves packet hash and decision logic
- Keeps data additive and feature-flagged
- Avoids new tables or write paths

**Consequences**:
- Positive: SDX preview available for demos with zero persistence risk
- Negative: Requires read-time computation on packet fetch
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Expand deterministic execution intent derivation (Phase 8.2)

**Context**: Phase 8.2 requires richer, deterministic intent derivation from existing decision/spec signals without changing decision logic.

**Decision**: Extend execution preview derivation rules to map decision status, risk level, and audit events into explicit intents with outcomes and source references.

**Rationale**:
- Keeps intent derivation deterministic and read-only
- Improves audit explainability without schema changes

**Consequences**:
- Positive: More actionable SDX preview content
- Negative: Additional mapping logic to maintain
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Add UI impact awareness mapping (Phase 8.3)

**Context**: Phase 8.3 requires deterministic UI impact awareness derived from execution intents without changing logic or persistence.

**Decision**: Attach UI impact enums and notes per intent plus a top-level UI impact summary in `execution_preview` under the existing feature flag.

**Consequences**:
- Positive: Clear UI impact awareness for demo and audit context
- Negative: Additional mapping logic to maintain
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Add spec completeness and stability signals (Phase 8.4)

**Context**: Phase 8.4 requires read-only execution readiness signals derived from spec and execution preview metadata.

**Decision**: Compute `spec_completeness` and `spec_stability` in `execution_preview` using deterministic rules and existing drift metadata.

**Consequences**:
- Positive: Clear readiness and drift context without persistence
- Negative: Additional read-time computation
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Add execution confidence vs decision confidence (Phase 8.5)

**Context**: Phase 8.5 requires a derived execution confidence score based on readiness signals, distinct from model confidence.

**Decision**: Compute execution confidence using weighted readiness factors and expose decision confidence separately for comparison.

**Consequences**:
- Positive: Clear separation of model confidence vs system readiness
- Negative: Additional read-time computation
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Integrate execution preview via progressive disclosure (Phase 8.6)

**Context**: Phase 8.6 requires read-only execution preview details to remain collapsed and uncluttered.

**Decision**: Surface execution preview sections behind collapsible panels with summary chips and empty states, keeping behavior unchanged.

**Consequences**:
- Positive: Read-only data remains accessible without cluttering the trace UI
- Negative: Requires small UI wiring in two surfaces
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Extend governance narrative with SDX sections (Phase 8.7)

**Context**: Phase 8.7 requires governance narrative to surface SDX execution preview details without altering behavior or workflows.

**Decision**: Add a collapsed SDX block that renders execution preview subsections (impact, readiness, UI implications, audit guarantees) using read-only execution preview fields.

**Consequences**:
- Positive: SDX details are visible in narrative form without adding new logic or persistence
- Negative: Slightly more narrative content when expanded
- Neutral: No effect when feature flag is off

**Status**: Accepted

### [2026-02-01] Add one-click governance narrative demo flow

**Context**: Interview demos need a fast, reliable way to seed deterministic audit packets and open the governance narrative with a single action.

**Decision**: Add a feature-flagged Run Demo action that seeds demo packets, fetches the newest packet hash, and navigates to the governance narrative with a talk-track panel.

**Rationale**:
- Keeps demo flow additive without backend changes
- Reuses existing seed and packet index endpoints
- Allows enablement only when VITE_FEATURE_GOV_DEMO is true

**Alternatives Considered**:
- Manual seed + copy/paste hash: Rejected (too slow for interviews)
- Auto-seed on page load: Rejected (surprising behavior)

**Consequences**:
- Positive: One-click demo readiness with consistent narrative script
- Negative: Slightly more header logic to maintain
- Neutral: No impact when feature flag is off

**Status**: Accepted

**Related**:
- Tasks: T-020

### [2026-02-01] Add governance readiness signals and spec-trace empty states

**Context**: Governance demos needed consistent read-only messaging and clear empty states when spec tracing is unavailable.

**Decision**: Add Governed AI badges and read-only copy in governance-facing views, plus a shared empty-state message for missing spec trace data (including Audit Packet view).

**Rationale**:
- Reinforces governance context without new logic changes
- Keeps messaging consistent across audit and narrative surfaces
- Provides clarity when spec tracing is disabled or unavailable

**Alternatives Considered**:
- Leave gaps when spec trace is missing: Rejected (confusing for demos)
- Add backend-driven flags: Rejected (UI-only requirement)

**Consequences**:
- Positive: Clearer trust signals and consistent empty-state UX
- Negative: Slightly more UI copy to maintain
- Neutral: No backend changes

**Status**: Accepted

**Related**:
- Tasks: T-019


### [2026-01-31] Add audit suite landing and demo script

**Context**: Recruiter demos require a single, repeatable entry point with clear steps to seed, compare, and export audit artifacts.

**Decision**: Add an Audit Suite landing card on Home, a collapsible demo script panel on Audit Packets, and align audit pages with shared loading/empty/error states.

**Rationale**:
- Keeps demo flow discoverable without redesigning core workflows
- Uses shared UI primitives for consistent states and minimal changes
- Ensures seeded cases deep-link directly into filtered packets

**Alternatives Considered**:
- Separate /audit landing page: Rejected (extra navigation for a small script)
- Long-form docs only: Rejected (demo needs in-app guidance)

**Consequences**:
- Positive: Faster, repeatable demos with clear next steps
- Negative: Slightly more UI copy to maintain
- Neutral: No backend changes

**Status**: Accepted

**Related**:
- Tasks: T-016

### [2026-01-31] Add feature-flagged spec trace metadata

**Context**: Governance demos need a lightweight, spec-driven trace attached to audit packets without altering decision outcomes.

**Decision**: Add a minimal spec registry + spec trace resolver and attach spec metadata to audit packets only when `FEATURE_SPEC_TRACE=1`.

**Rationale**:
- Keeps spec trace additive and non-invasive
- Reuses existing audit packet structure without changing logic or hashes
- Allows progressive population with demo-only specs

**Alternatives Considered**:
- Always-on spec trace: Rejected (risk of unintended changes)
- Embed spec definitions in packets: Rejected (larger payload, harder to maintain)

**Consequences**:
- Positive: Governance metadata available for demos
- Negative: Requires maintaining a small registry table
- Neutral: No effect when feature flag is off

**Status**: Accepted

**Related**:
- Tasks: T-017

### [2026-02-01] Capture override feedback as governance signal

**Context**: Reviewers need to record why they override AI decisions without altering execution logic.

**Decision**: Capture override feedback as audit events gated by `FEATURE_OVERRIDE_FEEDBACK`, storing reason and notes in event payload only.

**Rationale**:
- Keeps override feedback additive and read-only
- Reuses existing audit events persistence and idempotency
- Avoids any impact on decision execution or hashing

**Alternatives Considered**:
- New override table: Rejected (unnecessary schema expansion)
- Always-on logging: Rejected (feature-flag requirement)

**Consequences**:
- Positive: Governance signal captured with audit visibility
- Negative: Requires a small UI flow to collect feedback
- Neutral: No effect when feature flag is off

**Status**: Accepted

**Related**:
- Tasks: T-018

### [2026-01-31] Add deterministic demo seed for audit packets

**Context**: Demos need instant sample packets to validate list, view, verify, diff, and export flows.

**Decision**: Add a server endpoint that deterministically seeds a short sequence of audit packets with predictable timestamps and progressive changes.

**Rationale**:
- Enables quick demo setup without manual data
- Keeps packet content deterministic for repeatable testing
- Reuses existing packet persistence and hashing

**Alternatives Considered**:
- Client-only seeding: Rejected (no cross-device visibility)
- Randomized seeding: Rejected (non-deterministic diffs)

**Consequences**:
- Positive: Faster demos and easier QA
- Negative: Additional endpoint to secure in production
- Neutral: No schema changes

**Status**: Accepted

**Related**:
- Area: audit demo data

### [2026-01-31] Add audit packet index for server-stored packets

**Context**: Reviewers need a central list of persisted audit packets with one-click navigation.

**Decision**: Add a server-backed index endpoint and a new /audit/packets UI to list recent packets with view, verify, and compare actions.

**Rationale**:
- Improves discoverability of stored audit artifacts
- Keeps the UI server-first with no localStorage dependency
- Enables quick compare workflows per case

**Alternatives Considered**:
- Rely on manual hash entry: Rejected (poor UX)
- Local-only index: Rejected (no cross-device visibility)

**Consequences**:
- Positive: Faster access to audit packets and comparisons
- Negative: Adds a small list endpoint to backend
- Neutral: No schema changes

**Status**: Accepted

**Related**:
- Area: audit packets index

### [2026-01-31] Add deterministic audit diff PDF export

**Context**: Audit diff exports needed a premium PDF option that stays deterministic and matches the diff JSON.

**Decision**: Generate a lightweight PDF report from diff JSON using pdf-lib with stable content ordering and top-N summaries.

**Rationale**:
- Provides shareable reports without backend changes
- Ensures deterministic content derived from diff JSON
- Keeps UI exports aligned with audit requirements

**Alternatives Considered**:
- Server-side PDF rendering: Rejected (out of scope)
- HTML-to-PDF in browser: Rejected (less deterministic)

**Consequences**:
- Positive: Executive-ready artifact with consistent content
- Negative: Slight client-side CPU usage
- Neutral: No API changes

**Status**: Accepted

**Related**:
- Area: audit diff export

### [2026-01-31] Add explicit audit packet load-source badges

**Context**: Audit packet view needed clearer indication of local vs server load and a more helpful missing state.

**Decision**: Display a load-source badge, add server retry + verify link actions, and provide a paste-to-load fallback in the empty state.

**Rationale**:
- Clarifies where the packet was sourced
- Improves recovery when local storage is empty
- Keeps audit verification nearby

**Alternatives Considered**:
- Silent fallback without badge: Rejected (no transparency)
- Separate recovery page: Rejected (unnecessary navigation)

**Consequences**:
- Positive: Better operator confidence and faster recovery
- Negative: Slightly more UI logic
- Neutral: No backend changes

**Status**: Accepted

**Related**:
- Area: audit packet view

### [2026-01-31] Restore theme tokens and dark contrast baseline

**Context**: The workbench UI rendered washed out in dark mode due to global light theme overrides and missing token definitions.

**Decision**: Reintroduce shadcn-style CSS variables for background/foreground/muted tokens, enable Tailwind color mappings, and align global styles with theme tokens.

**Rationale**:
- Ensures consistent dark-mode contrast across pages
- Lets shared UI primitives render with intended token colors
- Eliminates light-theme input overrides that broke dark mode

**Alternatives Considered**:
- Ad hoc per-page text color overrides: Rejected (inconsistent)
- Hardcoding dark colors in Layout: Rejected (breaks light mode)

**Consequences**:
- Positive: Stable contrast for workbench and shared UI
- Negative: Requires maintaining token definitions
- Neutral: No backend changes

**Status**: Accepted

**Related**:
- Area: theming

### [2026-01-31] Polish audit diff UX for executive readability

**Context**: Command 11 requires the audit diff experience to be demo-grade, readable, and executive-friendly without adding backend features.

**Decision**: Refine the Audit Diff UI with same-hash states, count badges, collapsible lists, deep-link navigation from the workbench, and export metadata while reusing shared UI primitives.

**Rationale**:
- Improves scan-ability and clarity for stakeholders
- Keeps changes UI-only and preserves existing backend contracts
- Supports direct navigation via shareable deep links

**Alternatives Considered**:
- Full backend-driven diff export: Rejected (out of scope)
- Redesigning the workbench layout: Rejected (constraint)

**Consequences**:
- Positive: Cleaner diff presentation and faster reviews
- Negative: Slightly more client-side UI logic
- Neutral: No API or storage changes

**Status**: Accepted

**Related**:
- Tasks: T-011
- Area: audit diff UX

### [2026-01-31] Add audit diff report with deterministic matching

**Context**: Reviewers need to compare two audit packets to understand what changed between decisions for the same case.

**Decision**: Introduce a structured audit diff with deterministic signatures (evidence and human actions) plus a diff hash for exports. The UI computes the diff and exports JSON; backend optionally exposes diff/meta endpoints.

**Rationale**:
- Provides audit-grade comparison without redesigning the workbench
- Keeps deterministic matching stable across devices
- Enables future server-side diff without changing the FE structure

**Alternatives Considered**:
- Ad hoc UI comparison: Rejected (no deterministic structure)
- Full server-only diff: Deferred (FE-only works offline)

**Consequences**:
- Positive: Reviewers see deltas clearly and can export diff artifacts
- Negative: Additional computation on the client
- Neutral: Existing audit packet contracts unchanged

**Status**: Accepted

**Related**:
- Tasks: T-010
- Area: audit diff

### [2026-01-31] Persist verifier actions as append-only audit events

**Context**: Human actions must be traceable and replayable across devices.

**Decision**: Store verifier actions in the server-side `audit_events` table with idempotent clientEventId support. Frontend merges server events with local fallback and renders a replay view.

**Rationale**:
- Provides audit-grade history with append-only semantics
- Preserves offline fallback while preferring server data
- Enables unified replay alongside agent events

**Alternatives Considered**:
- Local-only storage: Rejected (not cross-device)
- Overwriting existing audit_events: Rejected (append-only required)

**Consequences**:
- Positive: Durable human action history
- Negative: Additional storage and API calls
- Neutral: Agent contracts unchanged

**Status**: Accepted

**Related**:
- Tasks: T-009
- Area: audit events

### [2026-01-31] Persist audit packets server-side with canonical hashing

**Context**: Share links must work across devices and verification should be possible server-side.

**Decision**: Add a thin audit packet persistence API with SQLite storage and server-side hash verification using the same canonicalization rules as the frontend.

**Rationale**:
- Enables cross-device sharing without changing agent contracts
- Keeps persistence minimal and auditable
- Ensures hash validation is consistent across FE/BE

**Alternatives Considered**:
- External storage service: Deferred
- Embedding packet JSON in share URLs: Rejected (size/security)

**Consequences**:
- Positive: Server retrieval + verification available
- Negative: Requires database storage
- Neutral: Frontend keeps localStorage fast path

**Status**: Accepted

**Related**:
- Tasks: T-009
- Area: audit persistence

### [2026-01-31] Normalize decision trace presentation in UI

**Context**: Repeated plan snapshots made the decision trace look broken and noisy.

**Decision**: Group consecutive trace events with identical signature in the UI, truncate previews, and show a compact chip summary without changing backend contracts.

**Rationale**:
- Improves readability and reduces visual noise
- Keeps deterministic contracts untouched
- Maintains filter behavior while normalizing presentation

**Alternatives Considered**:
- Filtering out duplicate events entirely: Rejected (loses history)
- Backend deduplication: Rejected (contract change)

**Consequences**:
- Positive: Cleaner trace display with repeat counts
- Negative: Requires UI-only grouping logic
- Neutral: Raw events remain available in expanded view

**Status**: Accepted

**Related**:
- Tasks: T-008
- Area: audit trace UX

### [2026-01-31] Use decision trace drawer for audit panel clarity

**Context**: The audit panel decision trace list was cramped and difficult to scan.

**Decision**: Show a compact top-3 trace preview in the audit panel and expose a full-width decision trace drawer with search, filtering, and lazy payload expansion.

**Rationale**:
- Improves readability without redesigning layout
- Preserves access to full trace details
- Keeps heavy JSON rendering out of the right panel

**Alternatives Considered**:
- Inline full trace list: Rejected (space constraints)
- Separate page: Rejected (navigation overhead)

**Consequences**:
- Positive: Cleaner audit panel and richer trace view
- Negative: Additional modal interaction
- Neutral: No backend changes

**Status**: Accepted

**Related**:
- Tasks: T-007
- Area: audit UX

### [2026-01-31] Add audit packet verification + local share links

**Context**: Verifiers need to validate packet integrity and share audit packets without backend persistence.

**Decision**: Add /audit/verify for hash verification using canonicalization rules and /audit/view for local share links backed by localStorage. Share links only contain IDs + packetHash.

**Rationale**:
- Maintains deterministic hashing rules
- Avoids backend changes while enabling sharing on same device
- Keeps audit verification explicit and repeatable

**Alternatives Considered**:
- Server-side packet storage: Deferred (requires backend)
- Embedding full packet in URL: Rejected (too large)

**Consequences**:
- Positive: Clear verification UX + local sharing
- Negative: Links only work on same device
- Neutral: Backend unchanged

**Status**: Accepted

**Related**:
- Tasks: T-006
- Area: audit packet UX

### [2026-01-30] Add PDF export + SHA-256 integrity hash for audit packets

**Context**: Verifiers need audit-grade exportability and integrity validation for agentic decisions.

**Decision**: Implement client-side PDF export using pdf-lib and compute a SHA-256 hash over a canonicalized audit packet (stable key ordering, excluding non-deterministic fields like generated timestamps). Display the hash in the UI and include it in JSON/PDF exports.

**Rationale**:
- Keeps audit exports deterministic and verifiable
- Avoids backend changes while enabling integrity checks
- Leverages lightweight client-side PDF generation

**Alternatives Considered**:
- Server-side PDF generation: Rejected (not required yet)
- Hash raw JSON with timestamps: Rejected (non-deterministic)

**Consequences**:
- Positive: Audit-grade exports with integrity signature
- Negative: Client-side PDF size limited by browser memory
- Neutral: Backend contracts unchanged

**Status**: Accepted

**Related**:
- Tasks: T-005
- Area: audit packet export

### [2026-01-30] Launch Agentic Workbench with JSON audit packet export

**Context**: Verifiers need a dedicated workbench with audit-grade traceability and exportable audit packets without changing backend semantics.

**Decision**: Add a new Agentic Workbench route with left/center/right panels, evidence viewer backed by localStorage, and JSON export. PDF export is intentionally stubbed for a future iteration.

**Rationale**:
- Delivers verifier-grade UX quickly without backend changes
- Keeps deterministic contracts intact
- Enables immediate audit packet export while deferring PDF complexity

**Alternatives Considered**:
- New backend export endpoint: Rejected (not required yet)
- Full PDF export now: Deferred (needs separate design + tooling)

**Consequences**:
- Positive: Premium audit UX with traceability and export
- Negative: PDF export still pending
- Neutral: No backend changes required

**Status**: Accepted

**Related**:
- Tasks: T-004
- Area: agentic workbench

### [2026-01-30] Agentic explainability via per-action drawer

**Context**: The agentic UI needs premium explainability without redesigning the layout or altering backend behavior.

**Decision**: Add a per-action “Why?” dialog that summarizes plan reasoning, rule outcomes, and trace metadata, with a copyable trace payload.

**Rationale**:
- Keeps explainability colocated with actions
- Avoids major layout changes while improving trust
- Uses existing trace data without backend changes

**Alternatives Considered**:
- Dedicated full-page explainability view: Rejected (too broad)
- Inline expanded trace JSON: Rejected (too noisy for primary action UI)

**Consequences**:
- Positive: Clear, on-demand explanations and audit-friendly copy
- Negative: Adds one more modal interaction
- Neutral: No backend changes required

**Status**: Accepted

**Related**:
- Tasks: T-003
- Area: agentic UI

### [2026-01-28] Adopt shadcn/ui tokens + app shell for premium UI

**Context**: The web UI needs a premium, modern treatment with consistent typography, spacing, and component styling while keeping existing business logic intact.

**Decision**: Introduce shadcn/ui primitives, tokenized theme variables, and a standard app shell (header, left nav, content container) while refactoring key pages to use shared components and subtle motion.

**Rationale**:
- Provides consistent visual hierarchy and spacing
- Enables dark mode with minimal code
- Keeps UI refactor scoped to presentation layer

**Alternatives Considered**:
- Custom CSS-only refactor: Rejected (harder to maintain consistency)
- Full UI redesign: Rejected (too broad for current scope)

**Consequences**:
- Positive: Premium look and reusable primitives
- Negative: Added frontend dependencies (Radix + sonner + framer-motion)
- Neutral: Business logic remains unchanged

**Status**: Accepted

**Related**:
- Tasks: T-001
- Area: frontend UI

---

### [2026-01-30] Add deterministic agentic workflow scaffold

**Context**: Need a first-class agentic workflow layer that is deterministic, auditable, and UI-actionable without breaking existing routes.

**Decision**: Add a shared contract plus a new agentic API that returns deterministic plans and actions. Persist agentic state in a new dedicated table to avoid altering existing case flows.

**Rationale**:
- Keeps agent behavior deterministic with explicit actions and schemas
- Provides auditable traces per response
- Isolated persistence avoids breaking current case workflows

**Alternatives Considered**:
- Reusing existing case status: Rejected (semantics differ)
- In-memory state only: Rejected (not persistent)

**Consequences**:
- Positive: Clear, testable plan/action contract
- Negative: Adds a new table and API surface area
- Neutral: Existing endpoints unchanged

**Status**: Accepted

**Related**:
- Tasks: T-001
- Area: agentic workflow

### [2026-01-22] Use Dict[str, Any] for PaginatedCasesResponse items

**Context**: Phase 7.29 added computed SLA fields (age_hours, sla_status) to case objects, but PaginatedCasesResponse used `List[CaseRecord]` which stripped these fields during Pydantic validation.

**Decision**: Changed `items: List[CaseRecord]` to `items: List[Dict[str, Any]]` in PaginatedCasesResponse model.

**Rationale**:
- Allows dynamic computed fields to pass through API response
- Avoids adding fields to base CaseRecord model (keeps it clean)
- Minimal change to existing codebase
- Preserves backward compatibility (dict is superset of model)

**Alternatives Considered**:
- Add age_hours/sla_status to CaseRecord: Rejected (pollutes base model, not always computed)
- Create CaseRecordWithSLA model: Rejected (too much duplication)
- Use response_model_exclude_unset: Rejected (doesn't help with missing fields)

**Consequences**:
- Positive: Flexible schema for computed fields, easy to extend
- Negative: Lose Pydantic validation on response items (rely on dict structure)
- Neutral: Frontend still gets typed interfaces via TypeScript

**Status**: Accepted

**Related**:
- Commit: 075c245
- Issue: Console "Backend Not Reachable" P0 fix
- File: backend/app/workflow/router.py

---

### [2026-01-22] Store trace labels in trace_metadata_json

**Context**: Phase 8.2 requires human labeling of traces (open codes, category, pass/fail, severity, notes) without adding new database tables.

**Decision**: Store labels in root span's `trace_metadata_json` field under `__labels` key.

**Rationale**:
- No schema migration needed
- Labels are semantically part of trace metadata
- Atomic updates with trace data
- Easy retrieval in single query

**Alternatives Considered**:
- New trace_labels table: Rejected (violates WIP=1 constraint, requires migration)
- Separate JSON column: Rejected (unnecessary complexity)
- Store in notes field: Rejected (not structured, hard to query)

**Consequences**:
- Positive: Zero migration cost, simple implementation
- Negative: Can't query labels efficiently (no indexed columns)
- Neutral: Labels are read-heavy, query performance acceptable for MVP

**Status**: Accepted

**Related**:
- Commit: 920c558
- Phase: 8.2 Trace Viewer with Labeling
- File: backend/src/api/routes/traces.py

---

### [2026-01-16] Use timezone-aware datetimes with UTC default

**Context**: SLA computation was crashing due to mixing timezone-naive and timezone-aware datetime objects.

**Decision**: All datetime comparisons must use timezone-aware objects. If input is naive, assume UTC and add `tzinfo=timezone.utc`.

**Rationale**:
- Python datetime subtraction requires both operands to have same timezone awareness
- UTC is standard for server-side timestamps
- Prevents future timezone bugs
- Minimal code change (add 2-line check)

**Alternatives Considered**:
- Make everything timezone-naive: Rejected (loses DST handling, not best practice)
- Convert to naive before comparison: Rejected (error-prone, hides issues)
- Use pytz library: Rejected (overkill for UTC-only requirement)

**Consequences**:
- Positive: Robust datetime handling, prevents 500 errors
- Negative: Assumes UTC for naive inputs (acceptable for this app)
- Neutral: Existing data unaffected (SQLite stores as text)

**Status**: Accepted

**Related**:
- Commit: 075c245
- Issue: Cases list 500 error
- File: backend/app/workflow/sla.py

### [2026-02-05] Add Explain v1 golden suite gate

**Context**: Explain v1 changes need a deterministic regression gate that exercises the full contract without relying on HTTP calls.

**Decision**: Add versioned golden case fixtures and a runner that reuses `build_explain_contract_v1`, validating status/risk/missing fields/rules and claim gating when citations are absent. Expose the runner via `/api/ops/golden/run` and include it in pytest + RC smoke.

**Rationale**:
- Ensures explain contract regressions are caught in CI and ops smoke
- Reuses the same build path to avoid divergence
- Keeps fixtures stable and easy to extend

**Alternatives Considered**:
- HTTP-only golden runs: Rejected (slower, less deterministic in tests)
- Snapshotting raw responses: Rejected (too brittle across benign changes)

**Consequences**:
- Positive: Deterministic gating for explain v1 behavior
- Negative: Adds lightweight fixture maintenance
- Neutral: No schema changes

**Status**: Accepted

**Related**:
- Tasks: T-026
- Area: explainability golden suite

### [2026-02-05] Include golden suite in ops smoke readiness

**Context**: Demo readiness should be validated by a single authoritative endpoint without requiring separate golden suite calls.

**Decision**: Execute a limited golden suite run inside `/api/ops/smoke` and surface the result as `checks.golden_suite` with a brief failure summary.

**Rationale**:
- Ensures a single demo-ready signal for Console
- Keeps the golden suite fast via a fixed limit
- Avoids two sources of truth during RC smoke

**Alternatives Considered**:
- Keep golden suite separate: Rejected (split readiness indicators)

**Consequences**:
- Positive: One-call readiness signal includes golden regression coverage
- Negative: Slightly longer ops smoke execution time
- Neutral: No schema changes

**Status**: Accepted

**Related**:
- Tasks: T-026
- Area: ops smoke readiness

---

## Superseded Decisions

*(Move obsolete decisions here when replaced by newer decisions)*

---

## Decision Process

1. **Identify**: Recognize when a decision has long-term architectural impact
2. **Document**: Use template above to record decision while context is fresh
3. **Review**: Share with team/user if decision affects roadmap or UX
4. **Commit**: Include ADR update in same commit as implementation
5. **Reference**: Link to decision from code comments if non-obvious

**What to Document**:
- Data model choices
- API design patterns
- Technology selections
- Performance tradeoffs
- Security approaches
- Major refactorings

**What NOT to Document**:
- Routine bug fixes
- Code formatting choices
- Dependency version bumps
- Obvious implementation details
