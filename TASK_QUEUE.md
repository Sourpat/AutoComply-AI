# Task Queue

**Last Updated**: 2026-02-01

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

---

## P1 - High Priority (Do Next)

### T-016: Audit suite demo readiness
**Status**: pending
**Assigned**: GitHub Copilot
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

### P8.6: Execution preview UX polish (TODO)
**Status**: pending
**Assigned**: (none)
**Goal**: Improve execution preview display density without changing logic
**Acceptance Criteria**:
- [ ] Collapsed preview remains fast and readable
**Verification**:
- Manual review only
**Dependencies**: None

---

## Completed Tasks (Last 5)

### P8.5: Execution confidence vs decision confidence (Phase 8.5)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Added execution confidence score and factor breakdown.

### P8.4: Spec completeness & stability signals (Phase 8.4)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Added spec completeness and stability signals to execution preview.

### P8.3: UI impact awareness layer (Phase 8.3)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Added UI impact mapping per intent and UI impact summary.

### P8.2: Execution preview intent derivation (Phase 8.2)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Expanded deterministic intent derivation from decision status, risk, and audit events.

### T-019: Governance narrative artifact (Command 4)
**Completed**: 2026-02-01
**Commit**: 1200295
**Summary**: Added governance readiness signals, consistent read-only messaging, and spec-trace empty states with build verification.

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
