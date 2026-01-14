# Connected Mode Fix - Verification Guide

## What Was Fixed

The RAG Explorer "Connected mode" was showing "No submissions available" even though the Compliance Console had items in the verification queue.

**Root Cause:**
- Backend API approach required submissions to be in the backend `submissions_store`
- Frontend Compliance Console never wrote to the backend store
- RAG Explorer couldn't see Console submissions

**Solution:**
- Created client-side localStorage-backed submission store
- Compliance Console now writes queue items to localStorage
- RAG Explorer reads from localStorage instead of backend API
- Both pages share the same data

## Files Modified

### New Files
1. **`frontend/src/lib/submissionStore.ts`** - localStorage-backed submission store
   - Stores up to 25 most recent submissions
   - Auto-deduplication by submission ID
   - Supports lookup by ID or traceId
   - Methods: `addSubmission()`, `addSubmissions()`, `listSubmissions()`, `getSubmission()`, `getSubmissionByTraceId()`

### Modified Files
1. **`frontend/src/pages/ConsoleDashboard.tsx`**
   - Added import: `import { submissionStore } from "../lib/submissionStore"`
   - Modified `fetchWorkQueue()` to write submissions to localStorage after fetching from backend
   - Maps backend submissions to store format with all necessary fields

2. **`frontend/src/features/rag/RegulatoryDecisionExplainPanel.tsx`**
   - Replaced backend API imports with submissionStore
   - Updated `loadRecentSubmissions()` to read from localStorage (synchronous)
   - Updated `loadTraceById()` to use store lookup
   - Added `loadTraceByTraceId()` for deep linking support
   - Updated dropdown UI to use new field names (id, createdAt, type instead of trace_id, created_at, csf_type)
   - Improved empty state messaging
   - Fixed evidence extraction from submission payload

## Verification Steps

### 1. Start the Application
```powershell
# Terminal 1: Start backend
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2: Start frontend
cd frontend
npm run dev
```

### 2. Verify Compliance Console Populates Store
1. Navigate to **Compliance Console** (`http://localhost:5173/console`)
2. Select **Ohio** tenant from dropdown
3. Verify the verification queue shows items (should have Hospital CSFs, Practitioner CSFs, etc.)
4. Open browser DevTools → Application → Local Storage → `http://localhost:5173`
5. Check for key `autocomply_submissions`
6. Verify it contains an array of submissions with:
   - `id`, `tenantId`, `type`, `title`, `status`, `risk`, `createdAt`, `payload`, `traceId`

### 3. Verify RAG Explorer Connected Mode
1. Navigate to **RAG Explorer** (`http://localhost:5173/console/rag`)
2. In **Decision Explain** section:
   - Select **Connected mode (recent submissions)** from dropdown
3. Verify the **Submission** dropdown shows recent submissions
   - Format: "Title - Status - Date"
   - Should match items from Compliance Console
4. Select a submission from dropdown
5. Click **Load Selected Submission**
6. Verify success message: "✓ Loaded {type} submission from {date}"

### 4. Verify Decision Explanation
1. After loading a submission, click **Explain Decision** button
2. Wait for processing (should show "Evaluating..." state)
3. Verify results show:
   - **Decision Summary** section with verdict, risk assessment, rationale
   - **Fired Rules** section with list of rules that triggered
   - **Evaluated Rules** section showing pass/fail/info for each rule
4. Should NOT show "No rules fired" or "No submissions available"

### 5. Verify Deep Linking
1. In Compliance Console, click **Open trace** button on any queue item
2. Should navigate to RAG Explorer with URL like:
   - `/console/rag?mode=connected&traceId=abc123`
3. RAG Explorer should:
   - Auto-switch to Connected mode
   - Auto-load the submission
   - Show ready banner: "Loaded {title} from {date}"
4. Click **Explain Decision** to verify it evaluates properly

### 6. Verify Cross-Page Sync
1. Start in RAG Explorer with Connected mode
2. Note which submissions are available
3. Navigate to Compliance Console
4. Wait for queue to load (this updates localStorage)
5. Navigate back to RAG Explorer → Connected mode
6. Dropdown should reflect any new/updated submissions
7. Data should sync automatically via localStorage

## Expected Behavior

### ✅ Success Indicators
- Compliance Console queue items appear in localStorage
- RAG Explorer Connected mode dropdown shows submissions
- Loading a submission succeeds with confirmation message
- Explain Decision shows fired rules and evaluation results
- Deep linking from "Open trace" works
- Data syncs between Console and RAG Explorer
- No "No submissions available" errors
- No "No rules fired" for valid submissions

### ❌ Known Limitations
- localStorage persists only 25 most recent submissions
- Clearing browser data clears submission store
- Store is per-tenant (currently hardcoded to "ohio")
- Requires visiting Compliance Console first to populate store

## Debugging Tips

### No Submissions in Dropdown
- Check localStorage in DevTools (Application → Local Storage)
- Verify `autocomply_submissions` key exists
- Navigate to Compliance Console to trigger queue fetch
- Verify backend is running and returning work queue data

### Submission Loads But "No Rules Fired"
- Check browser console for errors
- Verify `loadedTrace.payload` contains evidence data
- Check that `decisionTypeToUse` matches submission type
- Backend may not have rules for that CSF type (check backend logs)

### Deep Linking Doesn't Work
- Verify URL has both `mode=connected` and `traceId=xxx`
- Check that submission with that traceId exists in localStorage
- May need to refresh Compliance Console first to populate store

### Store Not Updating
- Check browser console for localStorage errors
- Verify localStorage quota not exceeded
- Try clearing localStorage and refreshing Console

## Architecture Notes

### Data Flow
```
Backend Work Queue
       ↓ (fetch)
ConsoleDashboard.fetchWorkQueue()
       ↓ (map + save)
submissionStore.addSubmissions()
       ↓ (persist)
localStorage["autocomply_submissions"]
       ↓ (read)
RegulatoryDecisionExplainPanel
       ↓ (evaluate)
Backend RAG Explain API
```

### Key Design Decisions
1. **Client-side only**: No backend submission store needed
2. **localStorage**: Simple, persistent, accessible from any page
3. **Auto-sync**: Console write + RAG read = automatic sync
4. **Deduplication**: Store removes old submissions with same ID
5. **Size limit**: 25 submissions max to avoid localStorage bloat

### Future Improvements
- [ ] Add tenant selector to RAG Explorer (currently hardcoded "ohio")
- [ ] Add refresh button to reload submissions from Console
- [ ] Show submission count in UI
- [ ] Add ability to clear old submissions
- [ ] Consider IndexedDB for larger storage quota
- [ ] Add submission search/filter in Connected mode

## Rollback Instructions

If this fix causes issues, revert these commits:
1. Delete `frontend/src/lib/submissionStore.ts`
2. Revert changes to `ConsoleDashboard.tsx` (remove submissionStore import and persistence code)
3. Revert changes to `RegulatoryDecisionExplainPanel.tsx` (restore backend API calls)

The backend endpoints can remain as-is (they're not actively used but don't cause harm).
