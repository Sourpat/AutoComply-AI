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

### Phase 9.4 — Policy Drift surfacing
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Added contract version capture, drift metadata in audit/trace APIs, and Policy Drift badges in Workbench + audit timeline.

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

### Phase 9.1 — AI Decision Contract (Core Artifact)
**Completed**: 2026-02-02
**Commit**: (pending)
**Summary**: Delivered AI decision contract schema, seed, read-only APIs, and startup migration safeguards.

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
