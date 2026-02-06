# Task Queue

**Last Updated**: 2026-02-05

**Active WIP**: 0

**Demo Ready RC Smoke**: powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1

---

## P0 - Critical (Do First)


> **Status Legend**: `pending` | `in-progress` | `blocked` | `completed`


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

### T-026: Explain golden suite gate
**Completed**: 2026-02-05
**Commit**: (pending)
**Summary**: Added golden-case fixtures, runner, ops endpoint, pytest gate, RC smoke step, and ops smoke golden suite check for Explain v1.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_golden_suite.py`
- `Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/ops/golden/run`

### T-025: Explain run retention + storage health
**Completed**: 2026-02-05
**Commit**: (pending)
**Summary**: Added retention/compaction utilities, storage health checks, and ops maintenance endpoint with tests.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_explain_maintenance.py backend/tests/test_ops_smoke.py`
- `powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1`

### T-024: Explain drift detection + ops drift lock
**Completed**: 2026-02-05
**Commit**: (pending)
**Summary**: Added explain drift classification, diff drift metadata, and ops smoke drift lock with tests.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_explain_drift.py backend/tests/test_ops_smoke.py`
- `powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1`

### T-023: Explain v1 strict validation + claim gate
**Completed**: 2026-02-05
**Commit**: (pending)
**Summary**: Added canonical validation, explain contract validation, and claim gating with tests and RC smoke verification.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_canonical_validation.py backend/tests/test_claim_gate.py backend/tests/test_explainability_contract.py backend/tests/test_ops_smoke.py`
- `powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1`

### T-022: Explain v1 concurrency + idempotency + correlation IDs
**Completed**: 2026-02-05
**Commit**: (pending)
**Summary**: Hardened explain run storage for concurrency, idempotency, and correlation IDs; added ops smoke idempotency check and tests.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_explain_runs_store.py backend/tests/test_explain_diff.py backend/tests/test_explain_idempotency.py backend/tests/test_ops_smoke.py`
- `Invoke-RestMethod http://127.0.0.1:8001/api/rag/explain/runs?submission_id=demo-sub-3 | ConvertTo-Json -Depth 50`

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

