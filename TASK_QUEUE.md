# Task Queue

**Last Updated**: 2026-02-07

**Active WIP**: 0

**Demo Ready RC Smoke**: powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1

---

## P0 - Critical (Do First)

### CI Hotfix — Verifier events + SLA dedupe
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Normalize verifier events output, cast event ids to string, ensure bulk events, and dedupe SLA reminders.
**Acceptance Criteria**:
- [x] Verifier events endpoint returns assigned/unassigned/action with string ids
- [x] Bulk assign/action events appear deterministically
- [x] SLA runner emits one prioritized reminder per submission per run
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_verifier_bulk_api.py tests/test_verifier_actions_api.py tests/test_decision_packet_api.py tests/test_sla_reminders.py`
- `npm run build`
**Dependencies**: None
**Notes**: Commit (HEAD)

### CI Hotfix — SLA stats distinct submission counts
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Compute SLA stats from current submission state with distinct submission counts, excluding closed submissions.
**Acceptance Criteria**:
- [x] SLA stats count distinct submissions for needs-info/decision/verifier buckets
- [x] Closed submissions excluded from SLA stats
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_sla_reminders.py`
**Dependencies**: None
**Notes**: Post-CI stats fix.

### CI Hotfix — Scope SLA stats to SLA-tracked submissions
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Restrict SLA stats to SLA-tracked submissions to avoid seeded/demo data inflating KPI during tests.
**Acceptance Criteria**:
- [x] SLA stats include only submissions with SLA escalation or emitted SLA events
- [x] Closed submissions excluded
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_sla_reminders.py`
- `C:/Python314/python.exe -m pytest -q tests/test_verifier_bulk_api.py tests/test_verifier_actions_api.py tests/test_decision_packet_api.py tests/test_sla_reminders.py`
**Dependencies**: None

### CI Hotfix — Reset stores between tests
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Ensure pytest isolation by clearing in-memory/singleton stores between tests to prevent SLA stats pollution.
**Acceptance Criteria**:
- [x] Stores backing SLA stats are cleared between tests
- [x] `tests/test_sla_reminders.py` passes when running full suite
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_sla_reminders.py`
- `C:/Python314/python.exe -m pytest -q`
**Dependencies**: None


> **Status Legend**: `pending` | `in-progress` | `blocked` | `completed`


### Phase 3.8 — RC Gate readiness + CI env guards
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Harden CI readiness wait, deterministic env, and backend log artifacts
**Acceptance Criteria**:
- [x] Backend startup uses readiness loop (no fixed sleep)
- [x] CI sets ENV=ci for backend + ops gates
- [x] Backend .data directory ensured in CI
- [x] Uvicorn logs uploaded on all runs
**Verification**:
- GitHub Actions RC Gate passes and logs artifact uploaded
- Local: `C:/Python314/python.exe -m pytest -q`
**Dependencies**: None
**Notes**: RC Gate green.


### Phase 3.10 — CI health version + intelligence schema
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Fix health version assertion and ensure intelligence schema bootstrap in CI/tests
**Acceptance Criteria**:
- [x] /health/details version assertion is env-safe (APP_VERSION or git/semver)
- [x] intelligence tables + indexes created deterministically
- [x] schema bootstrap runs in API startup and pytest fixtures
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_signal_intelligence.py backend/tests/test_health_details.py`
- `C:/Python314/python.exe -m pytest -q`
**Dependencies**: None
**Notes**: RC Gate green.


### Phase 4: Verifier Console uses real submitted cases
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Wire Verifier Console to real cases with backend list/detail endpoints and deterministic demo data.
**Phase 4.1–4.8**: COMPLETE (RC Gate: PASS — 2026-02-06)
**Phase 4 Subphases**:
- [x] 4.1–4.2: Real cases list/detail + filters
- [x] 4.3: Actions/notes/timeline
- [x] 4.4: Assignment + bulk ops + My Queue
- [x] 4.5: Decision packet JSON
- [x] 4.6: Decision packet PDF + audit ZIP
- [x] 4.7: Final decision + lock + snapshot
- [x] 4.8: Smoke runner + RC Gate coverage
**Acceptance Criteria**:
- [x] Backend: persist submissions → cases table / case store (or reuse workflow store)
- [x] Backend: list cases endpoint for verifier (filter/sort/pagination)
- [x] Backend: actions + notes + events endpoints (persisted)
- [x] Backend: assignment + bulk endpoints with assignee filters
- [x] Backend: decision packet endpoint (dp-v1) with explain citations
- [x] Backend: decision packet PDF + audit ZIP downloads
- [x] Frontend: Verifier Console uses /api/verifier/cases (list/detail + filters + errors)
- [x] Frontend: Verifier actions + notes + timeline
- [x] Frontend: My Queue + bulk actions + assignment controls
- [x] Frontend: Decision Packet panel + export JSON
- [x] Frontend: Export PDF + Audit ZIP download
- [x] Seed/Fixtures: deterministic 10 demo cases
- [x] Tests: API contract tests for list/detail endpoints
- [x] Tests: verifier actions + notes
- [x] Tests: verifier bulk + assignment
- [x] Tests: decision packet API
- [x] Tests: audit packet downloads
- [x] Docs: Phase4 demo script + architecture note
**Tasks**:
- [x] Backend store + schema bootstrap
- [x] Seed endpoint (/api/ops/seed-verifier-cases)
- [x] Verifier cases list/detail endpoints
- [x] Tests: test_verifier_cases_api.py
- [x] Frontend: Verifier Console wiring (list/detail + filters + errors + seed CTA)
- [x] Backend + frontend: verifier actions + notes + events
- [x] Tests: test_verifier_actions_api.py
- [x] Backend + frontend: assignment + bulk ops + my queue
- [x] Tests: test_verifier_bulk_api.py
- [x] Backend + frontend: decision packet panel + export JSON
- [x] Tests: test_decision_packet_api.py
- [x] Docs: PHASE4_PLAN.md + PHASE4_SMOKE.md updates
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_audit_packet_downloads.py`
- `npm run build`
- See docs/PHASE4_SMOKE.md
**Dependencies**: None
**Notes**: Kickoff for Phase 4 scope.


### Phase 4.8 — Verifier smoke runner + demo script + RC Gate
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Add deterministic verifier smoke runner, demo script, and CI gate coverage.
**Acceptance Criteria**:
- [x] Smoke runner endpoint returns ok with step report
- [x] Smoke runner pytest passes
- [x] RC Gate runs smoke runner test
- [x] Demo script doc added and linked
- [x] DECISIONS entry for smoke runner gate
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_verifier_smoke_runner.py`
- `npm run build`
**Dependencies**: None


### Phase 5.1 — Submitter → Verifier Queue linkage
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Create submitter submissions that flow into the verifier queue with idempotency.
**Acceptance Criteria**:
- [x] Submitter submission endpoint creates linked verifier case
- [x] Idempotent by submission_id or client_token
- [x] Verifier list/detail include submission summary
- [x] Verifier submission endpoint returns payload
- [x] Ops smoke check for submitter_to_verifier_flow
- [x] Tests added + passing
- [x] Docs: PHASE5 plan + smoke
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_submitter_to_verifier_flow.py`
- `npm run build`
**Dependencies**: None

### Phase 5.5 — Submission events feed + email hooks
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Durable submission event feed for submitter + verifier views with email hook stubs.
**Acceptance Criteria**:
- [x] Submission events stored in SQLite with indexes
- [x] Events emitted across create/open/needs-info/respond/upload/finalize
- [x] Submitter + verifier events endpoints added
- [x] Email hook writes outbox for needs-info + final decisions
- [x] Ops smoke + RC Gate coverage updated
- [x] Tests added + passing
- [x] Docs updated (PHASE5 smoke)
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_submission_events_feed.py`
- `npm run build`
**Dependencies**: None
**Notes**: Commit 2b26396

### Phase 5.6 — SLA reminders + escalation + counters
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Deterministic SLA reminders/escalation with stats counters for verifier + submitter.
**Acceptance Criteria**:
- [x] SLA due fields persisted and updated across lifecycle
- [x] Ops SLA runner emits due-soon/overdue events with escalation + email hook stubs
- [x] Stats endpoints for verifier + submitter + UI counters/filters
- [x] Tests added + passing
- [x] Docs updated (PHASE5 plan + smoke)
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_sla_reminders.py`
- `npm run build`
**Dependencies**: None
**Notes**: Commit (HEAD)











### Example Task Template (DELETE THIS AFTER READING)
```markdown
### T-001: Fix critical bug in X
**Status**: pending
**Assigned**: (none)
**Goal**: Resolve Y so that Z works correctly
**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
**Verification**:
- `pytest tests/test_x.py -v` (all pass)
- Manual test: navigate to /page, verify behavior
**Dependencies**: None
**Notes**: Related to Phase 7.29 SLA issue
```



### BUG-201: Fix Workbench cases loading
**Status**: blocked
**Assigned**: GitHub Copilot
**Goal**: Ensure the Agentic Workbench case list loads reliably via API fallback + alias routes
**Acceptance Criteria**:
- [ ] Workbench tries /api/workflow/cases, /api/agentic/cases, /api/console/work-queue in order
- [ ] Failed endpoint logs one clear console warning
- [ ] /api/console/work-queue alias returns work queue payload
- [ ] /api/workflow/cases alias returns workflow cases payload
- [ ] No DB schema changes
**Verification**:
- `npm -C frontend run build`
- `Invoke-RestMethod http://127.0.0.1:8001/api/workflow/cases?limit=10`
- `Invoke-RestMethod http://127.0.0.1:8001/api/agentic/cases?limit=10`
**Dependencies**: None
**Notes**: Blocked pending backend restart verification for /api/workflow and /api/console aliases.



### Phase 9.5 — Safe failure modes + UI surfacing
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Model policy overrides of AI auto-decisions and surface safe-failure context in APIs and UI
**Acceptance Criteria**:
- [x] Safe failure models + PolicyResult extension
- [x] Safe failure attached to DecisionOutcome
- [x] Safe failure endpoints (recent + by trace)
- [x] Safe failure tests
- [x] Workbench panel + Policy Override badge
- [x] Console work queue indicator + optional filter
**Verification**:
- `npm -C frontend run build`
- `C:/Python314/python.exe -m pytest tests/test_safe_failure_modes.py -v`
**Dependencies**: None

### Phase 9.4 — Policy Drift surfacing
**Status**: completed
**Assigned**: GitHub Copilot
**Goal**: Persist contract version per decision, compute drift vs active contract, and surface Policy Drift in Workbench + audit timeline
**Acceptance Criteria**:
- [x] Decision audit entries store `contract_version_used`
- [x] Audit/trace APIs return drift fields vs active contract
- [x] Workbench shows Policy Drift badge
- [x] Audit timeline shows Policy Drift badge
**Verification**:
- `npm -C frontend run build`
**Dependencies**: None

---

## P1 - High Priority (Do Next)

### T-016: Audit suite demo readiness
**Status**: deferred
**Assigned**: (none)
**Goal**: Finalize audit suite nav, landing, demo script, and UX consistency for recruiter demo
**Acceptance Criteria**:
- [ ] Audit suite nav links are stable with active styling
- [ ] Home has Audit Suite card with seed + prefilter behavior
- [ ] Audit Packets shows collapsible demo script panel
- [ ] Audit pages share loading/empty/error UX with retry
- [ ] Demo script documented in PROJECT_CONTEXT.md
- [ ] Frontend build passes
**Verification**:
- `npm run build` (frontend)
- Manual: /audit/packets, /audit/verify, /audit/diff
- Backend: GET /api/audit/packets?limit=5 returns array
**Dependencies**: None

---

## P2 - Medium Priority (Backlog)

---

## Completed Tasks (Last 5)

**Phase 8 Status**: DONE

### Phase 6.3 — Verifier queue server-side search
**Completed**: 2026-02-07
**Commit**: pending
**Summary**: Added server-side `q` filtering for verifier cases and wired the console queue to pass search queries.
**Verification**:
- `C:/Python314/python.exe -m pytest -q`
- `npm test -- --run`
- `npm run build`

### Phase 6.2 — Verifier Console submission + attachments
**Completed**: 2026-02-07
**Commit**: pending
**Summary**: Wired the Verifier Console submission panel to case-scoped submission data, attachments, and download actions.
**Verification**:
- `npm run build`
- `powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1`

### Phase 6.1 — Verifier Console real cases
**Completed**: 2026-02-07
**Commit**: pending
**Summary**: Replaced demoStore/workflowApi usage in Verifier Console with verifierCasesClient and refreshed drawer/actions to use real case data.
**Verification**:
- `cd frontend; $env:CI="1"; npm test -- --run`
- `cd backend; C:/Python314/python.exe -m pytest -q`

### Phase 5.4 — Submission status lifecycle (submitter ↔ verifier)
**Completed**: 2026-02-07
**Commit**: pending
**Summary**: Submission status lifecycle now updates from verifier actions and submitter responses with request-info metadata.
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_submission_status_flow.py`
- `npm run build`

### Phase 5.3 — Audit ZIP bundles snapshot + evidence
**Completed**: 2026-02-06
**Commit**: pending
**Summary**: Audit ZIP exports now include snapshot-aware decision packet, manifest, and evidence files with hashes.
**Verification**:
- `C:/Python314/python.exe -m pytest -q tests/test_audit_zip_includes_evidence.py`
- `npm run build`

---

## Task Workflow

1. **Create Task**: Add to appropriate priority section (P0/P1/P2)
2. **Claim Task**: Update status to `in-progress`, add your agent ID to Assigned
3. **Work**: Follow acceptance criteria, run verification commands
4. **Complete**: Update status to `completed`, move to "Completed Tasks" section
5. **Archive**: Keep last 5 completed tasks, move older ones to archive file

## Task ID Format

- `T-NNN`: Regular task (T-001, T-002, etc.)
- `P8.2-A`: Phase-specific subtask (Phase 8.2, subtask A)
- `BUG-XXX`: Bug fix task
- `CHORE-XXX`: Maintenance task

## Priority Guidelines

**P0 (Critical)**:
- Production outages
- Security vulnerabilities
- Blocking bugs that prevent core workflows
- Data corruption risks

**P1 (High)**:
- New features from committed roadmap
- Performance issues affecting UX
- Important bug fixes
- Missing test coverage for critical paths

**P2 (Medium)**:
- Nice-to-have features
- Refactoring for code quality
- Documentation improvements
- Tech debt cleanup


### BUG-205: Restore ops smoke endpoint
**Status**: blocked
**Assigned**: GitHub Copilot
**Goal**: Ensure GET /api/ops/smoke returns 200 locally and appears in OpenAPI
**Acceptance Criteria**:
- [ ] GET /api/ops/smoke returns 200 locally
- [ ] /api/ops/smoke appears in /openapi.json
- [ ] No auth required for /api/ops/smoke
**Verification**:
- `Invoke-RestMethod http://127.0.0.1:8001/api/ops/smoke`
- `Invoke-RestMethod http://127.0.0.1:8001/openapi.json | Select-String /api/ops/smoke`
**Dependencies**: None
**Notes**: Port 8001 is currently bound by an unknown process; need it freed to verify locally.

