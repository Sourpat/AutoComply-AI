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

*No tasks currently in P1*

---

## P2 - Medium Priority (Backlog)

*No tasks currently in P2*

---

## Completed Tasks (Last 5)

### T-011: Audit diff UX polish
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Polished diff UI readability, deep-link navigation, and export metadata.

### T-010: Audit diff report
**Completed**: 2026-01-31
**Commit**: 481b4bc
**Summary**: Added audit diff route, deterministic matching, and exportable diff hash.

### T-009: Audit events persistence + replay
**Completed**: 2026-01-31
**Commit**: 01d5cd7
**Summary**: Added server-side audit events persistence and replay UI, with server-first merge.

### T-008: Trace normalization UI
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Grouped repeated plan snapshots and truncated trace previews in audit panel and drawer.

### T-007: Audit panel trace UX polish
**Completed**: 2026-01-31
**Commit**: (pending)
**Summary**: Added verify shortcut and decision trace drawer with search and lazy payload expansion.

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
