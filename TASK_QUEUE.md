# Task Queue

**Last Updated**: 2026-01-22

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

*No tasks currently in P1*

---

## P2 - Medium Priority (Backlog)

*No tasks currently in P2*

---

## Completed Tasks (Last 5)

### T-007: Audit panel trace UX polish
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added verify shortcut and decision trace drawer with search and lazy payload expansion.

### T-006: Audit verification + share links
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added audit verification route, local share links with packet storage, and audit analytics.

### T-005: Audit packet PDF + integrity
**Completed**: 2026-01-30
**Commit**: (pending)
**Summary**: Enabled PDF export, SHA-256 hash integrity, human action events, and large-list performance safeguards.

### T-004: Agentic workbench + audit packet UX
**Completed**: 2026-01-30
**Commit**: (pending)
**Summary**: Added Agentic Workbench route with case list, evidence viewer, audit packet panel, and JSON export (PDF export deferred).

### T-003: Agentic UX polish + safety
**Completed**: 2026-01-30
**Commit**: (pending)
**Summary**: Added sticky action panel header with confidence bar, per-action explainability drawer, timeline grouping/filters, header scroll contrast, and action safety feedback.

### T-002: Agentic workflow loop + review handoff
**Completed**: 2026-01-30
**Commit**: d989318
**Summary**: Added agentic case store, events timeline, review decision endpoints, needs-input loop, and Review Queue agentic panel with demo seeding.

### T-001: Premium UI refresh (web)
**Completed**: 2026-01-30
**Commit**: (pending)
**Summary**: Added shadcn/ui primitives, app shell, dark mode, motion polish, and refreshed key UI surfaces. Lint still fails due to pre-existing ESLint/prop-types issues.

### T-000: Fix cases list endpoint 500 error
**Completed**: 2026-01-22
**Commit**: 075c245
**Summary**: Fixed timezone handling bug in compute_age_hours() causing Console "Backend Not Reachable" error. Changed PaginatedCasesResponse to use Dict[str, Any] for computed SLA fields.

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
