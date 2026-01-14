# Phase 2: Case Lifecycle Management Implementation

## Overview

**Objective**: Implement verifier actions and case lifecycle persistence for AutoComply-AI.

**Completion Status**: ✅ BACKEND COMPLETE | 🚧 FRONTEND IN PROGRESS

---

## ✅ Backend Implementation (COMPLETE)

### 1. Database Schema

**File**: `backend/app/workflow/phase2_schema.sql`

Three new tables created:

#### `case_notes`
```sql
CREATE TABLE IF NOT EXISTS case_notes (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    author_role TEXT NOT NULL,
    author_name TEXT,
    note_text TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

**Purpose**: Store internal notes for case communication

**Indexes**: case_id, created_at, author_role

#### `case_events`
```sql
CREATE TABLE IF NOT EXISTS case_events (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_payload_json TEXT DEFAULT '{}',
    actor_role TEXT,
    actor_name TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

**Purpose**: Enhanced event log for lifecycle actions

**Indexes**: case_id, created_at, event_type

#### `case_decisions`
```sql
CREATE TABLE IF NOT EXISTS case_decisions (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    decision TEXT NOT NULL,  -- APPROVED or REJECTED
    reason TEXT,
    details_json TEXT DEFAULT '{}',
    decided_by_role TEXT,
    decided_by_name TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

**Purpose**: Approval/rejection decisions with reasons

**Indexes**: case_id, created_at, decision

### 2. Pydantic Models

**File**: `backend/app/workflow/models.py`

**Added Models**:
- `CaseNote`: Note record with author tracking
- `CaseNoteCreateInput`: Input for creating notes
- `CaseEvent`: Event record with structured payload
- `CaseDecision`: Decision record with details
- `CaseDecisionCreateInput`: Input for decisions
- `TimelineItem`: Combined note/event for timeline view

### 3. Repository Layer

**File**: `backend/app/workflow/repo.py`

**Added Functions**:

```python
# Status validation
validate_status_transition(current, new) -> bool

# Notes
create_case_note(case_id, input) -> CaseNote
get_case_note(note_id) -> Optional[CaseNote]
list_case_notes(case_id) -> List[CaseNote]

# Events
create_case_event(case_id, type, payload, actor_role, actor_name) -> CaseEvent
list_case_events(case_id) -> List[CaseEvent]

# Timeline
get_case_timeline(case_id) -> List[TimelineItem]

# Decisions
create_case_decision(case_id, input) -> CaseDecision
get_case_decision(decision_id) -> Optional[CaseDecision]
get_case_decision_by_case(case_id) -> Optional[CaseDecision]
```

**Status Transition Rules**:
```python
ALLOWED_STATUS_TRANSITIONS = {
    NEW: [IN_REVIEW, BLOCKED, CLOSED],
    IN_REVIEW: [NEEDS_INFO, APPROVED, BLOCKED, CLOSED],
    NEEDS_INFO: [IN_REVIEW, BLOCKED, CLOSED],
    APPROVED: [CLOSED],
    BLOCKED: [IN_REVIEW, CLOSED],
    CLOSED: [],  # Terminal state
}
```

### 4. API Endpoints

**File**: `backend/app/workflow/router.py`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `PATCH` | `/workflow/cases/{id}` | Update status, assignee, etc. |
| `POST` | `/workflow/cases/{id}/notes` | Add a note |
| `GET` | `/workflow/cases/{id}/notes` | List notes |
| `GET` | `/workflow/cases/{id}/timeline` | Get combined timeline |
| `POST` | `/workflow/cases/{id}/decision` | Make decision |
| `GET` | `/workflow/cases/{id}/decision` | Get decision |

**Examples**:

```bash
# Update case status
curl -X PATCH http://localhost:8001/workflow/cases/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "in_review"}'

# Add a note
curl -X POST http://localhost:8001/workflow/cases/{id}/notes \
  -H "Content-Type: application/json" \
  -d '{"noteText": "Reviewed documentation", "authorRole": "reviewer"}'

# Get timeline
curl http://localhost:8001/workflow/cases/{id}/timeline

# Make decision
curl -X POST http://localhost:8001/workflow/cases/{id}/decision \
  -H "Content-Type: application/json" \
  -d '{"decision": "APPROVED", "reason": "Meets all requirements"}'
```

### 5. Migration Script

**File**: `backend/scripts/migrate_phase2_schema.py`

**Usage**:
```bash
cd backend
.venv\Scripts\python.exe scripts\migrate_phase2_schema.py
```

**Output**:
```
============================================================
Phase 2 Schema Migration
============================================================

📦 Applying Phase 2 schema extensions...
✓ Phase 2 schema applied successfully

🔍 Verifying Phase 2 schema...
✓ Table 'case_notes' exists
✓ Table 'case_events' exists
✓ Table 'case_decisions' exists
✓ Schema version 2: Phase 2: Case lifecycle - notes, events, and decisions
✓ Phase 2 schema verification passed

============================================================
✓ Phase 2 migration completed successfully!
============================================================
```

### 6. Backend Tests

**File**: `backend/tests/test_phase2_backend.py`

**Test Coverage** (9/9 passed ✅):
1. ✅ `test_validate_status_transitions` - Status transition rules
2. ✅ `test_create_case_note` - Note creation
3. ✅ `test_list_case_notes` - Note listing (ordered by time)
4. ✅ `test_case_timeline` - Combined timeline (notes + events)
5. ✅ `test_create_case_decision_approved` - Approval decision + status update
6. ✅ `test_create_case_decision_rejected` - Rejection decision + status update
7. ✅ `test_get_case_decision_by_case` - Decision retrieval
8. ✅ `test_status_transition_with_event` - Status change creates event
9. ✅ `test_note_creates_event` - Note creation creates event

**Run Tests**:
```bash
cd backend
.venv\Scripts\python.exe -m pytest tests\test_phase2_backend.py -v
```

---

## 🚧 Frontend Implementation (IN PROGRESS)

### 1. API Client Functions

**File**: `frontend/src/api/workflowApi.ts`

**Added Functions**:
- `updateCaseStatus(caseId, updates)` - PATCH /cases/{id}
- `addCaseNote(caseId, noteInput)` - POST /cases/{id}/notes
- `getCaseNotes(caseId)` - GET /cases/{id}/notes
- `getCaseTimeline(caseId)` - GET /cases/{id}/timeline
- `makeCaseDecision(caseId, decisionInput)` - POST /cases/{id}/decision
- `getCaseDecision(caseId)` - GET /cases/{id}/decision

**Added Types**:
- `CaseNote`
- `CaseNoteCreateInput`
- `CaseDecision`
- `CaseDecisionCreateInput`
- `TimelineItem`

### 2. UI Components (TO BE COMPLETED)

#### Status Dropdown (Summary Tab)
- [🚧 TODO] Add status badge with dropdown
- [🚧 TODO] Validate transitions client-side
- [🚧 TODO] Call `updateCaseStatus` on change
- [🚧 TODO] Show loading state during update
- [🚧 TODO] Handle errors (invalid transition)

#### Notes Panel (Notes Tab)
- [✅ DONE] Tab navigation exists
- [🚧 TODO] Fetch notes via `getCaseNotes`
- [🚧 TODO] Display notes list (newest first)
- [🚧 TODO] Add note form with text area
- [🚧 TODO] Call `addCaseNote` on submit
- [🚧 TODO] Real-time refresh after add

#### Decision Panel (Summary Tab)
- [🚧 TODO] Add "Approve" / "Reject" buttons
- [🚧 TODO] Show decision modal with reason field
- [🚧 TODO] Call `makeCaseDecision` on submit
- [🚧 TODO] Update case status after decision
- [🚧 TODO] Show existing decision if present

#### Timeline View (Timeline Tab)
- [✅ DONE] Tab navigation exists
- [🚧 TODO] Fetch timeline via `getCaseTimeline`
- [🚧 TODO] Display combined notes + events
- [🚧 TODO] Different styling for notes vs events
- [🚧 TODO] Sort by timestamp (newest first)

### 3. Queue List Updates

**File**: `frontend/src/features/cases/CaseDetailsPanel.tsx` (and queue components)

- [🚧 TODO] Update status badge colors
- [🚧 TODO] Reflect new statuses in filters
- [🚧 TODO] Show decision badges (APPROVED/REJECTED)

---

## Quick Start Guide

### Backend Setup

1. **Apply Phase 2 schema**:
   ```bash
   cd backend
   .venv\Scripts\python.exe scripts\migrate_phase2_schema.py
   ```

2. **Run tests**:
   ```bash
   .venv\Scripts\python.exe -m pytest tests\test_phase2_backend.py -v
   ```

3. **Start backend**:
   ```bash
   .venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
   ```

### Frontend Setup (after UI completion)

1. **Start frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

2. **Manual testing**:
   - Navigate to case in Console
   - Change status via dropdown → Verify API call + event created
   - Add note → Verify appears in Notes tab
   - View Timeline → Verify notes + events combined
   - Make decision → Verify status updates

---

## Testing Checklist

### Backend API Tests
- [✅] Status transition validation
- [✅] Note creation and listing
- [✅] Event creation
- [✅] Timeline merging
- [✅] Approval decision (updates status)
- [✅] Rejection decision (updates status)
- [✅] Decision retrieval

### Frontend Integration Tests (TODO)
- [🚧] Load case with backend data
- [🚧] Change status → See event in timeline
- [🚧] Add note → Appears in Notes tab
- [🚧] Add note → Appears in Timeline tab
- [🚧] Approve case → Status = approved
- [🚧] Reject case → Status = blocked
- [🚧] Invalid transition → Error message
- [🚧] Timeline shows notes + events sorted

### End-to-End Tests (TODO)
- [🚧] Submit form → Create case → Add note → Approve → Close
- [🚧] Submit form → Create case → Request info → Add note → Review → Reject → Close

---

## Architecture Decisions

### Status Transition Validation
- **Backend**: Enforced via `validate_status_transition` in repo layer
- **Frontend**: Client-side validation via dropdown (only show allowed transitions)
- **Why**: Defense in depth - prevent invalid transitions at both layers

### Event Creation
- **Strategy**: Repository functions create events automatically
  - `create_case_note` → creates note + note_added event
  - `create_case_decision` → creates decision + decision_made event + updates status
- **Router layer**: Creates events for router-specific actions (status change, assignment)
- **Why**: Ensures complete audit trail without caller needing to remember

### Timeline Merging
- **Backend**: `get_case_timeline` merges notes + events
- **Frontend**: Displays single unified timeline
- **Why**: Better UX - see all activity in one place

### Decision Flow
1. User clicks "Approve" or "Reject"
2. Frontend calls `POST /cases/{id}/decision`
3. Backend creates decision record
4. Backend updates case status (APPROVED → approved, REJECTED → blocked)
5. Backend creates decision_made event
6. Frontend refreshes case data
7. UI shows updated status + decision

---

## Database Schema Version

- **Version 1**: Phase 1 (cases, evidence, audit_events)
- **Version 2**: Phase 2 (case_notes, case_events, case_decisions) ← **CURRENT**

Check version:
```sql
SELECT version, description FROM schema_version ORDER BY version DESC LIMIT 1;
```

Expected output:
```
2 | Phase 2: Case lifecycle - notes, events, and decisions
```

---

## API Reference Summary

### Update Case Status
```typescript
PATCH /workflow/cases/{id}
Body: { status?: string, assignedTo?: string, ... }
Response: CaseRecord
```

### Add Note
```typescript
POST /workflow/cases/{id}/notes
Body: { noteText: string, authorRole?: string, ... }
Response: CaseNote
```

### Get Timeline
```typescript
GET /workflow/cases/{id}/timeline
Response: TimelineItem[] (notes + events, sorted desc)
```

### Make Decision
```typescript
POST /workflow/cases/{id}/decision
Body: { decision: "APPROVED" | "REJECTED", reason?: string, ... }
Response: CaseDecision
```

---

## Next Steps

1. Complete frontend UI components:
   - Status dropdown in Summary tab
   - Notes panel in Notes tab
   - Decision panel in Summary tab
   - Timeline view in Timeline tab

2. Add frontend validation:
   - Only show valid status transitions
   - Require reason for decisions
   - Prevent empty notes

3. Add loading/error states:
   - Show spinner during API calls
   - Display error messages
   - Optimistic UI updates

4. Test end-to-end workflow:
   - Submit → Review → Approve → Close
   - Submit → Review → Reject → Blocked

5. Update documentation:
   - Add screenshots
   - Update README with Phase 2 features
   - Create user guide

---

## Git Commit Message

When ready to commit:

```
Phase 2: case lifecycle, notes, and decision persistence

Backend:
- Created case_notes, case_events, case_decisions tables
- Added Pydantic models for notes, events, decisions, timeline
- Implemented repository functions with status validation
- Added API endpoints: PATCH /cases/{id}, POST /notes, GET /timeline, POST /decision
- Created migration script (migrate_phase2_schema.py)
- Added comprehensive pytest tests (9/9 passed)

Frontend:
- Added API client functions in workflowApi.ts
- Added TypeScript types for Phase 2 models
- [TODO] UI components for status dropdown, notes panel, decision panel

Tests:
- Backend: All tests passing (9/9)
- Frontend: [TODO]
- Integration: [TODO]
```

---

## Files Modified/Created

### Backend
- ✅ `app/workflow/phase2_schema.sql` (NEW)
- ✅ `app/workflow/models.py` (MODIFIED - added Phase 2 models)
- ✅ `app/workflow/repo.py` (MODIFIED - added Phase 2 functions)
- ✅ `app/workflow/router.py` (MODIFIED - added Phase 2 endpoints)
- ✅ `scripts/migrate_phase2_schema.py` (NEW)
- ✅ `tests/test_phase2_backend.py` (NEW)

### Frontend
- ✅ `src/api/workflowApi.ts` (MODIFIED - added Phase 2 API functions)
- 🚧 `src/features/cases/CaseDetailsPanel.tsx` (TO MODIFY - add UI components)

### Documentation
- ✅ `PHASE_2_IMPLEMENTATION.md` (NEW - this file)

---

**Status**: Backend implementation complete and tested. Frontend API layer complete. UI components pending.
