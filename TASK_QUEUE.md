# Task Queue

**Last Updated**: 2026-02-03

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

### BUG-204: Fix workflow proxy for console health
**Completed**: 2026-02-03
**Commit**: (pending)
**Summary**: Added /workflow proxy so Console health checks hit the backend in dev.
**Verification**:
- `Invoke-RestMethod http://localhost:5173/workflow/health`

### BUG-203: Fix console recovery + demo questions
**Completed**: 2026-02-03
**Commit**: (pending)
**Summary**: Standardized dev proxy/API base usage, added forced health refresh on retry, and demo question answers in chat.
**Verification**:
- `irm "http://127.0.0.1:8001/health/full" | ConvertTo-Json -Depth 10`
- `npm -C frontend run build`
- `http://localhost:5173/chat` demo questions answer locally

### BUG-202: Fix dev routing + chat queue end-to-end
**Completed**: 2026-02-03
**Commit**: (pending)
**Summary**: Limited Vite proxy to API-only routes, standardized chat client on `/api/v1/chat`, and verified chat-to-review-queue flow.
**Verification**:
- GET http://127.0.0.1:8001/health/full
- GET http://localhost:5173/chat (SPA HTML)
- POST http://127.0.0.1:8001/api/v1/chat/ask (200)
- GET http://127.0.0.1:8001/api/v1/admin/review-queue/items?limit=20 (item created)

### Fix Review Queue 403 (Auth headers parity)
**Completed**: 2026-02-03
**Commit**: (pending)
**Summary**: Normalized role + dev seed token headers across stack and tightened Review Queue auth.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_review_queue_auth.py`
- `npm -C frontend run build`
- Manual: http://localhost:5173/admin/review loads without 403

### Fix Chat page 404 (Chat API parity)
**Completed**: 2026-02-03
**Commit**: (pending)
**Summary**: Added /api/chat alias + health endpoint and aligned Chat UI to shared API base with diagnostics.
**Verification**:
- `C:/Python314/python.exe -m pytest -q backend/tests/test_chat_alias_routes.py`
- `npm -C frontend run build`
- Manual: http://localhost:5173/chat loads without {"detail":"Not Found"}


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

