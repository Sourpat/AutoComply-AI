# PHASE 2A - Submitter/Verifier Sync Fix Implementation Summary

## Root Cause Analysis

After investigating the codebase, I've identified the following issues causing the sync mismatch:

### Issue 1: Work Queue Using Demo Store Instead of API
**File**: `frontend/src/pages/ConsoleDashboard.tsx`
**Problem**: Line 538 loads work queue from `demoStore.getWorkQueue()` instead of calling the API `listCases()`
**Impact**: Verifier queue shows stale demo data, not real database cases

### Issue 2: refreshWorkQueue() Doesn't Actually Refresh
**File**: `frontend/src/pages/ConsoleDashboard.tsx` 
**Problem**: Line 824 just spreads the existing array instead of refetching from API
**Impact**: After submission deletion, verifier queue doesn't update to show cancelled cases removed

### Issue 3: No Cross-Component State Management
**Problem**: Submissions list and work queue are separate state silos
**Impact**: Changes in one view don't automatically reflect in the other

## Backend Status ✅

**All backend endpoints are CORRECT and working:**

1. ✅ `GET /submissions` - Excludes deleted by default, ORDER BY created_at DESC
2. ✅ `GET /workflow/cases` - Excludes cancelled by default, ORDER BY created_at DESC  
3. ✅ `DELETE /submissions/{id}` - Sets is_deleted=1, sets case.status='cancelled'
4. ✅ `POST /submissions` - Creates both submission AND linked case

**New endpoint added:**
- ✅ `GET /dev/consistency` - Debug endpoint showing counts and orphans

## Frontend Fixes Required

### Fix 1: Load Work Queue from API

**File**: `frontend/src/pages/ConsoleDashboard.tsx`

**Current (line 536-558)**:
```typescript
useEffect(() => {
  console.log('[ConsoleDashboard] Loading work queue from demoStore');
  const items = demoStore.getWorkQueue();
  
  // Map to display format
  const displayItems: WorkQueueItem[] = items.map(item => ({
    id: item.id,
    trace_id: item.traceId || '',
    facility: item.title,
    reason: item.reason || item.subtitle || '',
    age: item.age || 'Recently',
    priority: item.priority === 'high' ? 'High' : item.priority === 'medium' ? 'Medium' : 'Low',
    priorityColor: item.priorityColor || (
      item.priority === 'high' ? 'text-amber-700' : 'text-slate-600'
    )
  }));
  
  setWorkQueueItems(displayItems);
  setIsLoading(false);
  console.log(`[ConsoleDashboard] Loaded ${displayItems.length} work queue items`);
}, []);
```

**Fixed**:
```typescript
useEffect(() => {
  loadWorkQueue();
}, []);

const loadWorkQueue = async () => {
  setIsLoading(true);
  try {
    // Fetch from API
    const response = await listCases({ limit: 1000 });
    
    // Map CaseRecord[] to WorkQueueItem[] display format
    const displayItems: WorkQueueItem[] = response.items.map(caseRecord => ({
      id: caseRecord.id,
      trace_id: caseRecord.submissionId || '', // Use submissionId as trace
      facility: caseRecord.title,
      reason: caseRecord.summary || '',
      age: formatAgeShort(new Date(caseRecord.createdAt)),
      priority: 'Medium', // TODO: Map from caseRecord.priority if available
      priorityColor: 'text-slate-600'
    }));
    
    setWorkQueueItems(displayItems);
    console.log(`[ConsoleDashboard] Loaded ${displayItems.length} work queue items from API`);
  } catch (err) {
    console.error('[ConsoleDashboard] Failed to load work queue:', err);
    setError('Failed to load work queue');
  } finally {
    setIsLoading(false);
  }
};
```

### Fix 2: Make refreshWorkQueue() Actually Refresh

**File**: `frontend/src/pages/ConsoleDashboard.tsx`

**Current (line 822-825)**:
```typescript
const refreshWorkQueue = () => {
  // Force re-render by updating a dependency
  setWorkQueueItems([...filteredAndSortedItems]);
};
```

**Fixed**:
```typescript
const refreshWorkQueue = async () => {
  console.log('[ConsoleDashboard] Refreshing work queue from API...');
  await loadWorkQueue(); // Reuse the load function
};
```

### Fix 3: Fix Delete Handler to Await Refresh

**File**: `frontend/src/pages/ConsoleDashboard.tsx`

**Current (line 474-493)**:
```typescript
const handleDeleteSubmission = async (submissionId: string) => {
  setDeletingId(submissionId);
  try {
    await deleteSubmission(submissionId);
    
    // Remove from local state
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    
    // Show success toast
    setError(null);
    console.log('[ConsoleDashboard] Submission deleted:', submissionId);
    
    // Refresh work queue if needed
    refreshWorkQueue();
  } catch (err) {
    console.error('[ConsoleDashboard] Failed to delete submission:', err);
    setError(err instanceof Error ? err.message : 'Failed to delete submission');
  } finally {
    setDeletingId(null);
    setDeleteConfirmId(null);
  }
};
```

**Fixed**:
```typescript
const handleDeleteSubmission = async (submissionId: string) => {
  setDeletingId(submissionId);
  try {
    await deleteSubmission(submissionId);
    
    // Remove from local state
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    
    // Refresh work queue to remove cancelled case
    await refreshWorkQueue();
    
    console.log('[ConsoleDashboard] Submission deleted and queue refreshed:', submissionId);
  } catch (err) {
    console.error('[ConsoleDashboard] Failed to delete submission:', err);
    setError(err instanceof Error ? err.message : 'Failed to delete submission');
  } finally {
    setDeletingId(null);
    setDeleteConfirmId(null);
  }
};
```

### Fix 4: Import listCases from workflowApi

**File**: `frontend/src/pages/ConsoleDashboard.tsx`

**Add to imports (around line 1-20)**:
```typescript
import { listCases } from "../api/workflowApi";
import { formatAgeShort } from "../workflow/sla";
```

## Testing Plan

### Manual Test Steps

**Test 1: Consistency Check**
```bash
# 1. Start backend and frontend
# 2. Open browser DevTools → Network
# 3. Navigate to http://localhost:5173/console
# 4. Check API call: GET /workflow/cases → should return items array
# 5. Open http://localhost:8001/dev/consistency
# Expected: All counts match, no orphans
```

**Test 2: Create and Verify Counts**
```bash
# 1. Go to /submit/csf-facility
# 2. Fill out form and submit
# 3. Note the submission ID and case ID from response
# 4. Go to /console
# Expected:
#   - Submitter "My submissions" shows 1 item
#   - Verifier queue shows 1 case
#   - Case ID in queue matches case ID from response
```

**Test 3: Delete and Verify Sync**
```bash
# 1. In /console submitter view, click "Delete" on a submission
# 2. Confirm deletion
# Expected:
#   - Submission immediately disappears from "My submissions"
#   - Verifier queue refreshes and case is gone (status=cancelled excluded)
#   - Network tab shows: DELETE /submissions/{id} → 204
#   - Network tab shows: GET /workflow/cases → refetch
# 3. Check /dev/consistency
# Expected:
#   - submissions_active decrements
#   - cases_active decrements
#   - cases_cancelled increments
```

**Test 4: ID Mapping Verification**
```bash
# 1. Create a submission
# 2. In verifier queue, click on the case
# 3. Look at Submission Snapshot section
# Expected:
#   - "Submission ID" shows the same ID as in submitter list
#   - "Case ID" shows different ID (case's own ID)
#   - Both IDs are properly linked
```

## Implementation Checklist

Backend:
- [x] Create /dev/consistency endpoint
- [x] Verify GET /submissions default filters
- [x] Verify GET /workflow/cases default filters
- [x] Verify DELETE /submissions sets case.status='cancelled'

Frontend:
- [ ] Update ConsoleDashboard to load work queue from API
- [ ] Fix refreshWorkQueue() to actually refetch
- [ ] Update delete handler to await refresh
- [ ] Add imports for listCases and formatAgeShort
- [ ] Test complete flow: create → delete → verify counts

Documentation:
- [x] Root cause analysis
- [x] Backend verification
- [x] Frontend fix specifications
- [x] Testing plan

## Expected Outcomes

After implementing these fixes:

1. **Submitter list count** = Active submissions in database
2. **Verifier queue count** = Active cases in database (excluding cancelled)
3. **Deletion propagates** immediately to both views
4. **IDs are correct** - Case shows its own ID + linked submission ID
5. **Ordering is consistent** - Newest first in both views
6. **No orphans** - Every submission has a case, every case has a submission

## Files Changed

Backend:
- ✅ `backend/app/dev/__init__.py` (NEW - debug endpoint)
- ✅ `backend/src/api/main.py` (import and register dev router)

Frontend:
- ⏳ `frontend/src/pages/ConsoleDashboard.tsx` (load from API, fix refresh)

Total changes: 2 backend files (done), 1 frontend file (pending)
