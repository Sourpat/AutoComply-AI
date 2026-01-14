# Step 1.5 Connected Mode UX Testing Guide

## What Was Implemented

### A) Deduplication and Better Labels ✅
- Submissions dropdown now deduplicates by `submission.id`
- Sorted by `submittedAt` descending (newest first)
- New label format: `{displayName} | {status} | {submittedAt}`
- Status derived from linked work queue item if available

### B) Query Param Deep-linking ✅
- RAG Explorer now accepts:
  - `?mode=connected` - Auto-select Connected mode
  - `?submissionId=<id>` - Pre-select specific submission
  - `autoload=1` - Auto-load and scroll to explanation section
- Example URL: `/console/rag?mode=connected&submissionId=demo-sub-1&autoload=1`

### C) Compliance Console Integration ✅
- "Open trace" button now routes to RAG Explorer with deep-link
- Uses `submissionId` for proper linking
- Falls back to `traceId` if `submissionId` not available

### D) Trace-first Explainability ✅
**Connected Mode Logic:**
1. **If `submission.decisionTrace` exists:** Use it directly (trace-first)
2. **Else if `submission.payload` exists:** Run evaluator (fallback)
3. **If no data:** Show error

**This ensures:**
- Fast loading for submissions with stored traces
- Evaluator fallback for submissions without traces
- No dead-end screens

### E) UI Polish ✅
- **Filter Chips:** All / Blocked / Submitted buttons above dropdown
- **Better Button:** "Load Selected Submission" is right-aligned, normal size (not full-width)
- **Better Empty State:** Helpful CTAs instead of dead-end:
  - "Load a BLOCKED recent submission" (filters to blocked)
  - "Try a BLOCKED sandbox scenario" (switches to sandbox)

---

## Testing Steps

### Test 1: Filter Chips Work
1. Open RAG Explorer: http://localhost:5173/console/rag
2. Select "Connected mode" in Decision Source
3. Verify filter chips appear: **All | Blocked | Submitted**
4. Click **Blocked** - should show only demo-sub-1 (Ohio Hospital)
5. Click **Submitted** - should show demo-sub-2 and demo-sub-3
6. Click **All** - should show all 3 submissions
7. Verify count updates: "X submissions"

### Test 2: Improved Dropdown Labels
1. In Connected mode, check dropdown options
2. Verify format: `Ohio Hospital – Main Campus | blocked | 1/6/2026, 1:23:45 PM`
3. Each submission should show:
   - Display name (from submission)
   - Status (from work queue item)
   - Full date/time (localized)

### Test 3: Deep-link from Compliance Console
1. Navigate to Compliance Console: http://localhost:5173/console
2. Find "Ohio Hospital – Main Campus" in Work Queue
3. Click **"Open trace"** button
4. Should navigate to: `/console/rag?mode=connected&submissionId=demo-sub-1&autoload=1`
5. Verify:
   - ✅ Decision Source auto-selected to "Connected mode"
   - ✅ Dropdown auto-selected to "Ohio Hospital – Main Campus"
   - ✅ Page auto-scrolls to section 2 (Decision Explainability)
   - ✅ Submission auto-loads (no need to click Load button)

### Test 4: Trace-first Explainability (Blocked Submission)
1. After deep-link from Test 3, click **"Explain Decision"**
2. Should show:
   - ❌ BLOCKED badge
   - **Fired Rules:** "TDDD Certificate Required for Ohio Hospitals"
   - **Missing Evidence:** Valid TDDD certificate number, Certificate expiration date
   - **Next Steps:** Obtain TDDD certificate, Submit certificate number, Resubmit CSF
3. Verify console logs show: `[Connected] Using decisionTrace (trace-first mode)`

### Test 5: Empty State with CTAs
1. In Connected mode, select "Practitioner CSF – Dr. James Wilson" (demo-sub-3)
2. Click "Load Selected Submission"
3. Click **"Explain Decision"**
4. Should show friendly empty state:
   - ✅ Icon
   - "No rules fired"
   - "This submission likely contains complete data..."
   - Two CTA buttons:
     - **"Load a BLOCKED recent submission"** - should filter to blocked and reset state
     - **"Try a BLOCKED sandbox scenario"** - should switch to sandbox mode
5. Click "Load a BLOCKED recent submission"
   - Verify: Filter changes to "Blocked", dropdown shows demo-sub-1
6. Click "Try a BLOCKED sandbox scenario"
   - Verify: Switches to Sandbox mode, selects a blocked scenario

### Test 6: Evaluator Fallback (if payload but no trace)
1. Open browser DevTools → Application → Local Storage
2. Find `acai.submissions.v1`
3. Edit demo-sub-1: Remove `decisionTrace` field (keep `payload`)
4. Refresh page
5. Load demo-sub-1 in Connected mode
6. Click "Explain Decision"
7. Verify console shows: `[Connected] No decisionTrace found - falling back to evaluator`
8. Should still show explanation (from evaluator this time)

### Test 7: Deduplication Works
1. In browser DevTools → Console, run:
   ```javascript
   const store = JSON.parse(localStorage.getItem('acai.submissions.v1') || '[]');
   localStorage.setItem('acai.submissions.v1', JSON.stringify([...store, store[0]])); // Duplicate first submission
   location.reload();
   ```
2. Navigate to RAG Explorer → Connected mode
3. Dropdown should still show only 3 unique submissions (not 4)

### Test 8: Sorting Verification
1. In Connected mode dropdown, verify order:
   - First: Newest submission (most recent `submittedAt`)
   - Last: Oldest submission
2. Current seed order should be:
   1. Ohio Hospital (2h ago)
   2. Dr. Sarah Martinez (4h ago)
   3. Dr. James Wilson (6h ago)

---

## Expected Behavior Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Deduplication | ✅ | By `submission.id` |
| Sorting | ✅ | By `submittedAt` desc |
| Better labels | ✅ | `displayName \| status \| date` |
| Filter chips | ✅ | All/Blocked/Submitted |
| Deep-linking | ✅ | Query params work |
| Auto-load | ✅ | With `autoload=1` |
| Trace-first | ✅ | Uses `decisionTrace` if available |
| Evaluator fallback | ✅ | Runs if no `decisionTrace` |
| Empty state CTAs | ✅ | Helpful, not dead-end |
| Button polish | ✅ | Right-aligned, normal size |

---

## Troubleshooting

**If dropdown is empty:**
- Check localStorage has `acai.submissions.v1` and `acai.workQueue.v1`
- Clear data and refresh to re-seed: `localStorage.clear(); location.reload();`

**If deep-link doesn't work:**
- Verify URL has all params: `?mode=connected&submissionId=demo-sub-1&autoload=1`
- Check browser console for errors

**If filtering doesn't work:**
- Verify work queue items have correct `submissionId` linking
- Check status values match: 'blocked', 'submitted', 'needs_review', 'approved'

---

## Success Criteria ✅

- [x] Clicking "Open trace" on work queue → deep-links to RAG Explorer
- [x] No duplicate submissions in dropdown
- [x] Dropdown shows status from work queue
- [x] Filter chips work (All/Blocked/Submitted)
- [x] Trace-first mode uses stored `decisionTrace`
- [x] Evaluator fallback works when no trace
- [x] Empty state shows helpful CTAs, not dead-end
- [x] UI: Load button is right-aligned, normal size
