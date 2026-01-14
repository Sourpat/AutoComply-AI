# Step 2.8: Backend Integration for Submission Intake

## Overview
Updated the submission intake pipeline to use backend APIs when available, with automatic fallback to localStorage when backend is unavailable.

## Files Updated

### 1. frontend/src/workflow/submissionIntakeService.ts

**Changes:**
- Added imports for `workflowHealth`, `createCase`, `attachEvidence` from API client
- Modified `intakeSubmissionToCase()` to check backend health and use API when available
- Backend mode: Creates case via `POST /workflow/cases` and attaches evidence via `POST /workflow/cases/{caseId}/evidence/attach`
- LocalStorage mode: Uses existing workflow store (localStorage fallback)
- Audit events only written in localStorage mode (backend auto-creates them)

**Logic Flow:**

```
1. Health Check (2s timeout)
   ├─ Backend Healthy
   │  ├─ POST /workflow/cases (create case with submission_id, decision_type, sla_hours, due_at)
   │  ├─ POST /workflow/cases/{caseId}/evidence/attach (attach RAG evidence)
   │  └─ Backend auto-creates audit events (no manual audit writes)
   │
   └─ Backend Unavailable
      ├─ Create case via workflowStore (localStorage)
      ├─ Write audit events manually (SUBMITTED, NOTE_ADDED for case creation, NOTE_ADDED for evidence)
      └─ Store evidence in case metadata
```

### 2. frontend/src/hooks/useCsfActions.ts

**Changes:**
- Updated import to use `createSubmissionViaSelector` (tries backend, falls back to localStorage)
- Modified `submit()` function to create submission via backend when available
- Maintains backward compatibility with localStorage fallback

**Logic Flow:**

```
1. Try backend /csf/{type}/submit (existing)
   └─ Get backend submission_id, trace_id, decision

2. Create SubmissionRecord (NEW - uses selector)
   ├─ Backend Healthy: POST /submissions → store in backend + localStorage
   └─ Backend Down: Store in localStorage only

3. Create work queue case (calls intakeSubmissionToCase)
   ├─ Backend Healthy: POST /workflow/cases
   └─ Backend Down: localStorage workflow store
```

## API Endpoints Used

### When Backend Available:
1. **POST /submissions**
   - Creates submission record in backend
   - Returns: `{ id, decision_type, form_data, ... }`

2. **POST /workflow/cases**
   - Creates case with:
     - `submission_id` - Links to submission
     - `decision_type` - Type of CSF submission
     - `sla_hours` - SLA deadline in hours
     - `due_at` - ISO timestamp for SLA
   - Backend auto-creates audit events:
     - `case_created` - When case created
     - `status_changed` - When status changes
   - Returns: `{ id, status, submission_id, ... }`

3. **POST /workflow/cases/{caseId}/evidence/attach**
   - Attaches evidence items from RAG search
   - Payload: `{ evidence_items: [...] }`
   - Backend auto-creates `evidence_attached` audit event
   - Returns: `{ attached_count }`

4. **Existing RAG endpoint** (unchanged)
   - `POST /rag/regulatory/search` - Still called from frontend
   - Evidence results stored in backend via `/evidence/attach`

### When Backend Unavailable:
- All operations use localStorage
- `submissionStore` - Stores submissions
- `workflowStore` (demoStore) - Stores cases and audit events
- Manual audit event creation
- Evidence stored in case metadata

## Testing Strategy

### Test 1: Backend Available (Connected Mode)
```bash
# Terminal 1: Start backend
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001

# Terminal 2: Start frontend
cd frontend
npm run dev

# Actions:
1. Submit CSF Practitioner form
2. Verify success banner appears
3. Click "Open Case" - should navigate to Console
4. Verify case appears in work queue
5. Check Console Network tab - should see:
   - POST /submissions
   - POST /workflow/cases
   - POST /workflow/cases/{caseId}/evidence/attach
6. Refresh page - case should persist (backend storage)
```

### Test 2: Backend Unavailable (Offline Mode)
```bash
# Stop backend server (or never start it)

# Actions:
1. Submit CSF Practitioner form
2. Verify success banner appears
3. Click "Open Case" - should navigate to Console
4. Verify case appears in work queue
5. Check Console Network tab - should see failed health check
6. Check Console logs - should see "Backend unavailable, using localStorage"
7. Refresh page - case should persist (localStorage)
```

### Test 3: Failover Scenario
```bash
# Start with backend running
1. Submit form - creates case in backend
2. Stop backend server
3. Refresh page - health check fails
4. Submit another form - creates case in localStorage
5. Restart backend
6. Submit form - creates case in backend again

# Expected:
- First case visible if you query backend directly
- Second case only in localStorage (lost on backend)
- Third case persists in backend
```

## Verification Checklist

### Backend Mode (when API available):
- [x] Submission created via `POST /submissions`
- [x] Case created via `POST /workflow/cases` with submission_id
- [x] Evidence attached via `POST /workflow/cases/{caseId}/evidence/attach`
- [x] Backend auto-creates audit events (no manual writes from frontend)
- [x] Case visible in work queue after creation
- [x] "Open Case" deep link works
- [x] Case persists after page refresh
- [x] RAG search still executed from frontend

### LocalStorage Mode (when API unavailable):
- [x] Submission stored in localStorage
- [x] Case created via workflowStore
- [x] Manual audit events written (SUBMITTED, NOTE_ADDED × 2)
- [x] Evidence stored in case metadata
- [x] Case visible in work queue after creation
- [x] "Open Case" deep link works
- [x] Case persists in localStorage after refresh
- [x] RAG search still executed from frontend

### Health Check:
- [x] Health check runs with 2s timeout
- [x] Automatic fallback to localStorage on timeout
- [x] Console logging for mode detection
- [x] No errors thrown on backend unavailable

## Benefits

1. **Seamless Integration**: Uses backend when available without breaking existing functionality
2. **Automatic Fallback**: No user action needed - system detects backend availability
3. **Consistent UX**: Identical user experience in both modes
4. **Data Persistence**: Backend mode provides true persistence across sessions
5. **Audit Trail**: Backend auto-creates comprehensive audit events
6. **Evidence Management**: Backend properly stores and retrieves RAG evidence

## Next Steps

1. **Update UI Components** to use backend data:
   - ConsoleDashboard.tsx - Display backend cases
   - CaseDetailsPanel.tsx - Show backend audit events
   - Evidence panels - Display backend-stored evidence

2. **Add Backend Sync**:
   - Option to sync localStorage cases to backend when it comes online
   - Conflict resolution for duplicate cases

3. **Enhanced Error Handling**:
   - Retry logic for transient backend failures
   - User notification when in offline mode
   - Background sync when backend becomes available

4. **Performance Optimization**:
   - Cache backend health check result (currently 2s timeout per submission)
   - Batch evidence attachment for multiple items
   - Optimistic UI updates with background sync
