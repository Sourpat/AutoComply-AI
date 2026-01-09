# Verification Work Queue - Testing Guide

## What Was Implemented

A **Unified Verification Work Queue** on the Compliance Console that aggregates verification work from:
- **CHAT** review items (from admin review queue)
- **CSF** submissions (from submissions store)
- **LICENSE** verification artifacts (ready for future integration)

## Files Changed/Added

### Backend
- **`backend/src/api/routes/ops.py`**: Added `/api/v1/admin/ops/submissions` endpoint to list CSF submissions from the unified store

### Frontend
- **`frontend/src/api/opsClient.ts`**: New API client for fetching CSF/License submissions
- **`frontend/src/components/VerificationWorkQueue.tsx`**: New component that renders the unified queue
- **`frontend/src/pages/ComplianceConsolePage.tsx`**: Added VerificationWorkQueue section after SystemStatusCard

## Features

### Unified Table
- **Columns**: Source | Status | Title | Jurisdiction | Risk | Reason Code | Age | Action
- **Sorting**: Newest items first (sorted by created_at descending)
- **Action**: "Open →" link routes to appropriate detail view:
  - CHAT → `/admin/review/{id}`
  - CSF → `/console` (will be enhanced with specific CSF route)
  - LICENSE → `/license` (will be enhanced with specific license route)

### Counters
- **Total**: All items in queue
- **Needs Review**: OPEN + IN_REVIEW status
- **Published**: PUBLISHED + RESOLVED status
- **Blocked**: BLOCKED status

### Filters
- **Status**: All Status, OPEN, IN_REVIEW, RESOLVED, PUBLISHED, BLOCKED
- **Source**: All Sources, CHAT, CSF, LICENSE
- **Jurisdiction**: All Jurisdictions + dynamically populated from data
- **Reason Code**: All Reason Codes + dynamically populated from data
- **Risk Level**: All Risk Levels, LOW, MEDIUM, HIGH

## How to Test Locally

### Prerequisites
```powershell
# Ensure backend and frontend are running
cd C:\Users\sourp\AutoComply-AI-fresh

# Backend (Port 8001)
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Frontend (Port 5173)
cd frontend
npm run dev
```

### Test Steps

#### 1. Verify Backend Endpoint Works
```powershell
# Test CSF submissions endpoint
curl http://localhost:8001/api/v1/admin/ops/submissions

# Expected: JSON array of submissions (may be empty initially)
```

#### 2. Create Test Data

**Option A: Use existing CSF sandbox to create submissions**
1. Navigate to http://localhost:5173/csf
2. Fill out and submit a Hospital CSF form
3. Fill out and submit a Facility CSF form
4. These will create submissions in the store

**Option B: Use CHAT to create review items**
1. Navigate to http://localhost:5173/chat
2. Ask questions that trigger "NEEDS_REVIEW" (e.g., edge cases, jurisdiction mismatches)
3. These will appear in the admin review queue

#### 3. View Verification Work Queue
1. Navigate to http://localhost:5173/console
2. Scroll to "Verification Work Queue" section (appears after System Status)
3. Verify:
   - ✅ Table displays with proper columns
   - ✅ Counters show correct totals
   - ✅ Source badges show CHAT and CSF items
   - ✅ Status badges have appropriate colors
   - ✅ Risk badges reflect risk levels
   - ✅ Age shows as "5m", "2h", or "1d" format
   - ✅ "Open →" links are clickable

#### 4. Test Filters
1. **Status Filter**: Select "OPEN" → table should filter to only OPEN items
2. **Source Filter**: Select "CHAT" → table should show only CHAT items
3. **Risk Filter**: Select "HIGH" → table should show only HIGH risk items
4. **Clear Filters**: Select "All" options → table should show all items again

#### 5. Test Navigation
1. Click "Open →" on a CHAT item
   - Should navigate to `/admin/review/{id}`
2. Click "Open →" on a CSF item
   - Should navigate to `/console` (or specific CSF route when available)

## Expected Results

### Empty State
If no submissions exist:
```
Verification Work Queue
Unified queue across CHAT, CSF, and LICENSE verification

Total: 0 | Needs Review: 0 | Published: 0 | Blocked: 0

[Filters]

Table: "No items match the current filters"
```

### With Data
```
Verification Work Queue
Unified queue across CHAT, CSF, and LICENSE verification

Total: 5 | Needs Review: 3 | Published: 1 | Blocked: 1

[Filters: Status | Source | Jurisdiction | Reason Code | Risk]

Source | Status    | Title                          | Jurisdiction | Risk   | Reason        | Age | Action
-------|-----------|--------------------------------|--------------|--------|---------------|-----|--------
CHAT   | OPEN      | What are Ohio TDDD requirements| OH           | MEDIUM | LOW_SIMILARITY| 2h  | Open →
CSF    | BLOCKED   | Hospital CSF – Riverside Gen   | OH           | HIGH   | —             | 5m  | Open →
CHAT   | PUBLISHED | Can I ship schedule II to CA?  | CA           | LOW    | —             | 1d  | Open →
...
```

## Troubleshooting

### Queue shows "Loading verification queue..."
- Check browser console for errors
- Verify backend is running on port 8001
- Check network tab for failed API calls

### "Error: Failed to fetch review queue" or "Failed to fetch ops submissions"
- Verify backend endpoints are accessible:
  ```powershell
  curl http://localhost:8001/api/v1/admin/review-queue/items
  curl http://localhost:8001/api/v1/admin/ops/submissions
  ```
- Check CORS is enabled in backend
- Verify API_BASE is set correctly in frontend

### No CSF items appear
- CSF submissions only appear after forms are submitted via /csf/facility/submit or /csf/hospital/submit
- Check submission store has items:
  ```python
  from src.autocomply.domain.submissions_store import get_submission_store
  store = get_submission_store()
  print(store.list_submissions())
  ```

### Filters don't work
- Check browser console for errors
- Verify filteredEvents useMemo is recomputing on filter changes
- Test with different combinations

## Future Enhancements

1. **Add LICENSE artifact integration** when license verification queue is available
2. **Enhance CSF routing** to link to specific CSF detail pages (e.g., `/csf/submissions/{id}`)
3. **Add refresh button** to manually reload queue
4. **Add auto-refresh** every 30 seconds
5. **Add bulk actions** (assign, approve, reject)
6. **Add SLA indicators** (highlight items over 24h)
7. **Add priority sorting** (HIGH risk items first)
8. **Add search/filter by title or ID**
9. **Add export to CSV** functionality
10. **Add real-time updates** via WebSocket when available

## Notes

- Queue is **frontend-only aggregation** - no backend changes to existing decision logic
- Uses existing **VerificationWorkEvent contract** from `frontend/src/contracts/verificationWorkEvent.ts`
- **fromChatReviewItem()** is fully implemented
- **fromCSFArtifact()** maps OpsSubmission to VerificationWorkEvent
- **fromLicenseArtifact()** is ready but returns stub data until license queue is available
- All compliance logic remains unchanged - this is a read-only ops view
