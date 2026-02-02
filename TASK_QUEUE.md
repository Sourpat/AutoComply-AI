# Task Queue

**Last Updated**: 2026-02-01

**Active WIP**: 1

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

### Phase 9.1 — AI Decision Contract (Core Artifact)
**Status**: in-progress
**Assigned**: GitHub Copilot
**Goal**: Establish the AI decision contract as the source of truth with schema validation, versioning, seeding, and read-only APIs
**Acceptance Criteria**:
- [ ] Contract model/entity defined
- [ ] Schema validation enforced for contract payload
- [ ] Versioning + active contract resolution
- [ ] Seed v1 active contract
- [ ] Read-only APIs for contract access
**Verification**:
- Manual review of contract API responses
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

### P8.9: Validation & polish (Phase 8.9)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Aligned SDX terminology, empty-state messaging, and confidence tooltip copy.

### P8.8: Feature flag & demo safety (Phase 8.8)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Hardened SDX demo seeding, list response enrichment, and empty-state messaging.

### P8.7: Governance narrative SDX extension (Phase 8.7)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Extended governance narrative with SDX sections derived from execution preview.

### P8.6: Execution preview UI integration (Phase 8.6)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Added collapsed execution preview sections with summary chips and empty states.

### P8.5: Execution confidence vs decision confidence (Phase 8.5)
**Completed**: 2026-02-01
**Commit**: (pending)
**Summary**: Added execution confidence score and factor breakdown.

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
