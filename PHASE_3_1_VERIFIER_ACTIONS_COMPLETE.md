# Phase 3.1 + 3.2: Verifier Actions + Timeline - IMPLEMENTATION COMPLETE

**Date**: January 14, 2026  
**Status**: ✅ All backend + frontend work complete

## Summary

Implemented persistent verifier actions with SQLite-backed case events timeline. All actions (Assign, Unassign, Request Info, Approve, Reject) now persist to backend and create timeline events. Cancelled cases are read-only.

---

## Files Changed

### Backend (8 files)

1. **backend/app/workflow/schema.sql**
   - Added `case_events` table with indexes
   - Fields: id, case_id, created_at, event_type, actor_role, actor_id, message, payload_json

2. **backend/app/workflow/models.py**
   - Updated `CaseEvent` model to match new schema
   - Added event type documentation

3. **backend/app/workflow/repo.py**
   - Updated `create_case_event()` - new signature with actor_role, actor_id, message, payload_dict
   - Updated `list_case_events()` - added limit parameter, newest-first ordering

4. **backend/app/workflow/router.py**
   - Added `GET /workflow/cases/{case_id}/events` - retrieve timeline
   - Added `POST /workflow/cases/{case_id}/assign` - assign case
   - Added `POST /workflow/cases/{case_id}/unassign` - unassign case
   - Added `POST /workflow/cases/{case_id}/status` - change status
   - All endpoints return 409 for cancelled cases

5. **backend/app/submissions/router.py**
   - Added `case_created` event after submission creation
   - Added `submission_updated` event after PATCH
   - Added `submission_cancelled` + `status_changed` events after DELETE

### Frontend (3 files)

6. **frontend/src/api/workflowApi.ts**
   - Added `CaseEvent` interface
   - Added `getCaseEvents(caseId)`
   - Added `assignCase(caseId, assignee)`
   - Added `unassignCase(caseId)`
   - Added `setCaseStatus(caseId, status, reason?)`

7. **frontend/src/utils/dateUtils.ts** (NEW FILE)
   - Added `safeFormatDate()` - prevents "Invalid Date" errors
   - Added `safeFormatDateOnly()` - date without time
   - Added `safeFormatRelative()` - "2 hours ago" formatting

8. **frontend/src/features/cases/CaseDetailsPanel.tsx**
   - Imported action APIs and dateUtils
   - Updated `handleStatusChange()` - calls `setCaseStatus()`, dispatches events
   - Updated `handleAssign()` - calls `assignCase()`, blocks cancelled cases
   - Updated `handleUnassign()` - calls `unassignCase()`, blocks cancelled cases
   - Added `loadCaseEvents()` function
   - Replaced Timeline tab with real backend events display
   - Added cancelled case warning banner
   - Disabled action buttons for cancelled cases

---

## API Endpoints

### 1. Get Case Events (Timeline)

```bash
curl -X GET http://localhost:8001/api/v1/workflow/cases/{{case_id}}/events \
  -H "Authorization: Bearer admin"
```

**Response:**
```json
[
  {
    "id": "evt-123",
    "caseId": "case-456",
    "createdAt": "2026-01-14T10:30:00Z",
    "eventType": "case_created",
    "actorRole": "system",
    "actorId": null,
    "message": "Case created from submission by Dr. Sarah Smith",
    "payloadJson": "{\"submission_id\":\"sub-789\",\"decision_type\":\"csf_practitioner\",\"initial_status\":\"new\"}"
  }
]
```

### 2. Assign Case

```bash
curl -X POST http://localhost:8001/api/v1/workflow/cases/{{case_id}}/assign \
  -H "Authorization: Bearer admin" \
  -H "Content-Type: application/json" \
  -d '{
    "assignee": "admin@example.com"
  }'
```

**Response:** Updated `CaseRecord` with `assignedTo` set

**Errors:**
- 404: Case not found
- 409: Case is cancelled (read-only)

### 3. Unassign Case

```bash
curl -X POST http://localhost:8001/api/v1/workflow/cases/{{case_id}}/unassign \
  -H "Authorization: Bearer admin"
```

**Response:** Updated `CaseRecord` with `assignedTo` cleared

**Errors:**
- 404: Case not found
- 409: Case is cancelled (read-only)

### 4. Change Status

```bash
curl -X POST http://localhost:8001/api/v1/workflow/cases/{{case_id}}/status \
  -H "Authorization: Bearer admin" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reason": "All documentation verified"
  }'
```

**Response:** Updated `CaseRecord` with new status

**Errors:**
- 404: Case not found
- 409: Case is cancelled (read-only)
- 400: Invalid status value

**Valid Status Values:**
- `new`
- `in_review`
- `needs_info`
- `approved`
- `rejected`
- `blocked`
- `closed`

---

## Event Types

| Event Type | Actor Role | Trigger | Payload |
|------------|-----------|---------|---------|
| `case_created` | system | Submission POST | `{submission_id, decision_type, initial_status}` |
| `assigned` | verifier | Assign action | `{assignee}` |
| `unassigned` | verifier | Unassign action | `{}` |
| `status_changed` | verifier/system | Status change | `{from, to, reason?}` |
| `submission_updated` | submitter | Submission PATCH | `{submission_id}` |
| `submission_cancelled` | submitter | Submission DELETE | `{submission_id}` |

---

## Testing Guide

### Manual Verification

1. **Start servers:**
   ```powershell
   cd backend
   .\.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
   
   # Terminal 2
   cd frontend
   npm run dev
   ```

2. **Create submission → Check timeline:**
   - Open http://localhost:5173/submit/csf-practitioner
   - Fill form, click Submit
   - Go to Console → Click case
   - Click "Timeline" tab
   - **Expected**: "Case created" event appears

3. **Assign case:**
   - Click "Assign" button
   - Select verifier
   - **Expected**: 
     - Case shows assigned
     - Timeline shows "Assigned" event

4. **Approve case:**
   - Click "Approve" button
   - **Expected**:
     - Status changes to approved
     - Timeline shows "Status changed" event with from/to payload

5. **Refresh browser:**
   - Close and reopen case
   - **Expected**: All state persists (assignment, status, timeline)

6. **Test cancelled case (read-only):**
   - Create submission
   - Go to "My submissions" (submitter view)
   - Delete submission
   - Go to verifier view, open case
   - **Expected**:
     - Warning banner: "Case is read-only (submission was deleted)"
     - All action buttons disabled
     - Timeline shows "Submission cancelled" event

7. **Cross-view sync:**
   - Assign case in verifier view
   - Switch to submitter view
   - **Expected**: Case status reflects in submitter's submission list

---

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS case_events (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL,
    created_at TEXT NOT NULL,  -- ISO 8601 UTC
    event_type TEXT NOT NULL,
    actor_role TEXT NOT NULL,  -- verifier, submitter, system
    actor_id TEXT,             -- NULL for system events
    message TEXT,
    payload_json TEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id_created_at 
ON case_events(case_id, created_at DESC);
```

---

## Example Timeline Display

When a case goes through the full lifecycle:

1. **Case created** (system) - "Case created from submission by Dr. Sarah Smith"
2. **Assigned** (admin) - "Case assigned to admin@example.com"
3. **Status changed** (admin) - "Status changed from new to in_review"
4. **Submission updated** (submitter) - "Submission updated by submitter"
5. **Status changed** (admin) - "Status changed from in_review to approved: All documentation verified"

Each event shows:
- Icon (🆕, 👤, 🔄, ✅, etc.)
- Event label
- Message
- Actor (ID or role)
- Timestamp (absolute + relative)
- Payload details (for status changes, assignments)

---

## Edge Cases Handled

1. **Cancelled cases**:
   - 409 error returned from all action endpoints
   - Frontend shows warning banner
   - All buttons disabled
   - Timeline shows cancellation events

2. **Invalid dates**:
   - `safeFormatDate()` returns "Unknown" instead of crashing
   - Console warnings for debugging

3. **Empty timeline**:
   - Shows "No timeline events yet" instead of blank screen

4. **Cross-view synchronization**:
   - CustomEvent `acai:data-changed` dispatched after mutations
   - Submitter dashboard refreshes on window focus

5. **Backward compatibility**:
   - Demo store still updated for legacy code paths
   - No breaking changes to existing components

---

## Next Steps

### Recommended Enhancements

1. **Add more event types:**
   - `note_added` (when verifier adds internal note)
   - `evidence_attached` (when evidence is curated)
   - `decision_made` (when case is finalized)

2. **Rich timeline filtering:**
   - Filter by event type
   - Filter by actor
   - Search event messages

3. **Real-time updates:**
   - WebSocket connection for live timeline updates
   - Toast notifications when events occur

4. **Export timeline:**
   - Add "Export Timeline" button
   - Generate PDF with event history

---

## Verification Checklist

- [x] Schema created and applied
- [x] Events repo functions work
- [x] Endpoints return correct responses
- [x] Frontend actions call backend
- [x] Timeline displays real events
- [x] Cancelled cases blocked correctly
- [x] Date parsing prevents "Invalid Date"
- [x] Cross-view sync working
- [x] All event types documented

**Status**: ✅ Ready for production use

