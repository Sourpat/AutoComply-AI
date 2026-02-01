# Task Queue

**Last Updated**: 2026-01-31

**Active WIP**: 0 (no tasks in progress)

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
**Status**: in-progress
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

*No tasks currently in P2*

---

## Completed Tasks (Last 5)

### T-015: Audit demo seed packets
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added deterministic demo seed endpoint and UI trigger for audit packets.

### T-014: Audit packet index page
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added audit packet index endpoint and UI list with view/verify/compare actions.

### T-013: Audit diff PDF export
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added deterministic PDF export for audit diffs with premium formatting.

### T-012: Audit packet view fallback UX
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added load-source badge, retry actions, and improved missing state in audit packet view.

### T-011: Audit diff UX polish
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Polished diff UI readability, deep-link navigation, and export metadata.

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
