# Phase 2: Quick Summary & Next Steps

## ✅ What's Complete (Backend)

**Database**: 3 new tables (`case_notes`, `case_events`, `case_decisions`)  
**API Endpoints**: 6 new endpoints for notes, timeline, decisions, status updates  
**Tests**: 9/9 backend tests passing  
**Migration**: Schema migrated successfully  

### Test Results
```
$ pytest tests/test_phase2_backend.py -v

test_validate_status_transitions PASSED
test_create_case_note PASSED
test_list_case_notes PASSED
test_case_timeline PASSED
test_create_case_decision_approved PASSED
test_create_case_decision_rejected PASSED
test_get_case_decision_by_case PASSED
test_status_transition_with_event PASSED
test_note_creates_event PASSED

9 passed in 0.44s ✓
```

## 🚧 What's Next (Frontend)

The backend is fully functional. Frontend needs UI components added to `CaseDetailsPanel.tsx`:

### 1. Status Dropdown (Priority: HIGH)
**Location**: Summary tab, near case title  
**API**: `updateCaseStatus(caseId, { status: newStatus })`  
**Validation**: Only show allowed transitions from current status  

**Allowed Transitions**:
```typescript
const transitions = {
  new: ['in_review', 'blocked', 'closed'],
  in_review: ['needs_info', 'approved', 'blocked', 'closed'],
  needs_info: ['in_review', 'blocked', 'closed'],
  approved: ['closed'],
  blocked: ['in_review', 'closed'],
  closed: [], // terminal
};
```

### 2. Notes Panel (Priority: HIGH)
**Location**: Notes tab (already exists)  
**API**: 
- Fetch: `getCaseNotes(caseId)`
- Add: `addCaseNote(caseId, { noteText: text })`

**UI Elements**:
- List of notes (newest first)
- Text area for new note
- "Add Note" button
- Author name + timestamp for each note

### 3. Decision Panel (Priority: MEDIUM)
**Location**: Summary tab, below case info  
**API**: `makeCaseDecision(caseId, { decision: 'APPROVED'|'REJECTED', reason: text })`  

**UI Elements**:
- "Approve" and "Reject" buttons (green/red)
- Modal with reason field
- Auto-updates case status after decision

### 4. Timeline View (Priority: MEDIUM)
**Location**: Timeline tab (already exists)  
**API**: `getCaseTimeline(caseId)`  

**UI Elements**:
- Combined list of notes + events
- Different icons for notes vs events
- Sorted by timestamp (newest first)

## Quick Test (Backend)

Start backend and test with curl:

```bash
# Terminal 1: Start backend
cd backend
.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001

# Terminal 2: Test endpoints
# Get a case ID first
curl http://localhost:8001/workflow/cases | jq '.items[0].id'

# Set CASE_ID variable (replace with actual ID)
$CASE_ID = "your-case-id-here"

# Add a note
curl -X POST http://localhost:8001/workflow/cases/$CASE_ID/notes `
  -H "Content-Type: application/json" `
  -d '{"noteText": "Test note from API"}'

# Get timeline
curl http://localhost:8001/workflow/cases/$CASE_ID/timeline | jq

# Update status
curl -X PATCH http://localhost:8001/workflow/cases/$CASE_ID `
  -H "Content-Type: application/json" `
  -d '{"status": "in_review"}'

# Make decision
curl -X POST http://localhost:8001/workflow/cases/$CASE_ID/decision `
  -H "Content-Type: application/json" `
  -d '{"decision": "APPROVED", "reason": "All requirements met"}'
```

## Frontend Implementation Guide

### Step 1: Add State Variables
```typescript
// In CaseDetailsPanel.tsx
const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
const [timeline, setTimeline] = useState<TimelineItem[]>([]);
const [decision, setDecision] = useState<CaseDecision | null>(null);
```

### Step 2: Fetch Data on Load
```typescript
useEffect(() => {
  if (!caseId || !isApiMode) return;
  
  // Fetch notes
  getCaseNotes(caseId).then(setCaseNotes);
  
  // Fetch timeline
  getCaseTimeline(caseId).then(setTimeline);
  
  // Fetch decision
  getCaseDecision(caseId).then(setDecision);
}, [caseId, isApiMode]);
```

### Step 3: Add Status Dropdown
```typescript
<select 
  value={caseItem?.status} 
  onChange={async (e) => {
    await updateCaseStatus(caseId, { status: e.target.value });
    // Refresh case data
    onCaseUpdate?.();
  }}
>
  {getAllowedTransitions(caseItem?.status).map(status => (
    <option key={status} value={status}>{status}</option>
  ))}
</select>
```

### Step 4: Add Notes UI
```typescript
// In Notes tab
<div>
  <h3>Notes</h3>
  <textarea 
    value={newNoteText} 
    onChange={(e) => setNewNoteText(e.target.value)}
    placeholder="Add a note..."
  />
  <button onClick={async () => {
    await addCaseNote(caseId, { noteText: newNoteText });
    setNewNoteText('');
    // Refresh notes
    setCaseNotes(await getCaseNotes(caseId));
  }}>Add Note</button>
  
  <div className="notes-list">
    {caseNotes.map(note => (
      <div key={note.id} className="note">
        <div className="note-author">{note.authorName || note.authorRole}</div>
        <div className="note-text">{note.noteText}</div>
        <div className="note-time">{new Date(note.createdAt).toLocaleString()}</div>
      </div>
    ))}
  </div>
</div>
```

### Step 5: Add Decision Buttons
```typescript
// In Summary tab
<div className="decision-actions">
  <button 
    className="approve-btn"
    onClick={async () => {
      const reason = prompt('Approval reason (optional):');
      await makeCaseDecision(caseId, { 
        decision: 'APPROVED', 
        reason: reason || undefined 
      });
      onCaseUpdate?.();
    }}
  >
    ✓ Approve
  </button>
  
  <button 
    className="reject-btn"
    onClick={async () => {
      const reason = prompt('Rejection reason:');
      if (reason) {
        await makeCaseDecision(caseId, { 
          decision: 'REJECTED', 
          reason 
        });
        onCaseUpdate?.();
      }
    }}
  >
    ✗ Reject
  </button>
</div>
```

## Files to Modify

1. **frontend/src/features/cases/CaseDetailsPanel.tsx**
   - Add import statements for Phase 2 API functions
   - Add state variables for notes, timeline, decision
   - Add useEffect to fetch Phase 2 data
   - Add status dropdown in Summary tab
   - Add notes UI in Notes tab
   - Add decision buttons in Summary tab
   - Add timeline view in Timeline tab

2. **frontend/src/workflow/statusTransitions.ts** (if exists)
   - Update allowed transitions map
   - Add helper function `getAllowedTransitions(currentStatus)`

## Commit When Ready

```bash
git add .
git commit -m "Phase 2: case lifecycle, notes, and decision persistence"
git push
```

## References

- **Full Documentation**: `PHASE_2_IMPLEMENTATION.md`
- **Backend Tests**: `backend/tests/test_phase2_backend.py`
- **API Endpoints**: `backend/app/workflow/router.py` (lines 920-1188)
- **Frontend API**: `frontend/src/api/workflowApi.ts` (lines 308-478)

---

**Current Status**: Backend 100% complete. Frontend API layer complete. UI components need implementation.

**Estimated Time to Complete Frontend**: 2-3 hours for basic UI, 4-6 hours for polished UX
