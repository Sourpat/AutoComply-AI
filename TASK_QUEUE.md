# Task Queue

**Last Updated**: 2026-02-02

**Active WIP**: 0

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

### Phase 10.0 — Deployment Stability + Data Consistency Hardening
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Added startup migrations, /health/db checks, env indicator, and smoke tests.

### Phase 9.9 — Override analytics
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Added override metrics endpoint and Console dashboard section.

### Phase 9.8 — Override RBAC hardening
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Enforced role gating and rationale validation for overrides.

### Phase 9.7 — Governance evidence + audit trail
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Logged policy overrides as audit events and included governance metadata in exports.

### Phase 9.6 — Policy override workflow
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Added override persistence, API workflow, and UI controls.

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
