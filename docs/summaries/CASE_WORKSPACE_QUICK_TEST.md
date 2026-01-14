# Case Workspace Quick Verification Guide

**Quick test checklist to verify all 7 tabs work correctly**

---

## ⚡ Quick Test (5 minutes)

### 1. Submission Tab - Empty State
```
✓ Navigate to /console
✓ Click any case
✓ Click "Submission" tab
✓ If no submission → See amber warning with "View Submission" button
✓ Click "Back to Summary" → Returns to summary
```

### 2. Playbook Tab - Contrast
```
✓ Click "Playbook" tab
✓ Verify text is readable (not dark gray on dark background)
✓ Check all step states: blocked (red), attention (yellow), satisfied (green)
✓ Expand a step → Content should be readable
```

### 3. Workbench Tab - Demo Data
```
✓ Click "Workbench" tab
✓ See "Demo Mode" badge if backend is off
✓ See adherence percentage (50-100%)
✓ See completed steps list
✓ See missing steps list
✓ See recommended actions with CTAs
```

### 4. Explainability Tab - Enhanced
```
✓ Click "Explainability" tab
✓ See Decision Summary with status badge
✓ See Key Decision Drivers (3 items with +/- percentages)
✓ See Evidence Snapshot (3 items with verification status)
✓ See Counterfactual Analysis
✓ Click "Open in RAG Explorer" → Navigates to RAG
```

### 5. Timeline Tab - Demo Events
```
✓ Click "Timeline" tab
✓ See events list (not empty)
✓ See case created event
✓ See case assigned event (if assigned)
✓ See note events (if notes added)
✓ See attachment events (if attachments added)
```

### 6. Notes Tab - Timeline Integration (API Mode)
```
✓ Start backend: cd backend && .venv/Scripts/python -m uvicorn src.api.main:app --port 8001
✓ Click "Notes" tab
✓ Add note: "Test note"
✓ Go to Timeline tab → See new "Added note" event
✓ Go back to Notes → Delete note
✓ Go to Timeline → See "Deleted note" event
```

### 7. Attachments Tab - Timeline Integration (API Mode)
```
✓ Click "Attachments" tab
✓ Add attachment: "test.pdf"
✓ Go to Timeline → See "Attached file: test.pdf" event
```

---

## 🎯 Expected Results

### All Tabs Working
- ✅ No crashes
- ✅ No TypeScript errors
- ✅ Proper error messages (amber warnings)
- ✅ All CTAs working
- ✅ Readable text (high contrast)
- ✅ Demo mode fallbacks working

### Timeline Events Created
When backend is running (API mode):
- Adding note → Timeline event created
- Deleting note → Timeline event created
- Adding attachment → Timeline event created

When backend is off (demo mode):
- Timeline shows sample events based on case history

---

## 🐛 What to Look For

### Red Flags
- ❌ Blank screens
- ❌ "Cannot read property 'X' of undefined" errors
- ❌ Dark gray text on dark backgrounds
- ❌ "Requires API mode" messages in demo mode
- ❌ Empty timeline in demo mode

### Green Flags
- ✅ Amber warning boxes with clear messages
- ✅ "View Submission" and "Back" buttons
- ✅ Readable text in all states
- ✅ Demo adherence showing percentage
- ✅ Explainability showing decision breakdown
- ✅ Timeline showing events in demo mode

---

## 📝 Quick Commands

### Start Backend (API Mode)
```powershell
cd backend
.venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8001
```

### Start Frontend
```powershell
cd frontend
npm run dev
```

### Navigate to Console
```
http://localhost:5173/console
```

---

## 🎨 Visual Checks

### Playbook Colors (Should be LIGHT theme)
- Blocked: Light red background (`bg-red-50`) with dark red text (`text-red-700`)
- Attention: Light yellow background (`bg-yellow-50`) with dark yellow text (`text-yellow-700`)
- Satisfied: Light green background (`bg-green-50`) with dark green text (`text-green-700`)

### Submission Empty State
- Amber background (`bg-amber-50`)
- Warning icon: ⚠️
- Two buttons: "View Submission →" and "← Back to Summary"

### Workbench Demo Mode
- "Demo Mode" badge in header
- Adherence percentage badge (green if >80%, yellow if >50%, red otherwise)
- Completed steps: Green boxes
- Missing steps: Gray boxes
- Recommended actions: Sky blue boxes with CTAs

---

## 💡 Common Issues

### Issue: Submission tab shows "No submission data available"
**Expected:** This is normal if case has no submissionId
**Fix:** Not needed - empty state is working correctly

### Issue: Workbench shows "requires API mode"
**Cause:** Old code before fix
**Fix:** Make sure you're running latest code (should show demo adherence)

### Issue: Timeline is empty
**Cause:** Not in demo mode fallback (API mode but backend not responding)
**Fix:** Either start backend OR ensure `isApiMode = false`

### Issue: Notes don't create timeline events
**Cause:** Backend not running
**Expected:** Timeline events only created in API mode
**Fix:** Start backend to test timeline integration

---

**Last Updated:** 2024  
**Estimated Test Time:** 5-10 minutes  
**Status:** All tabs verified ✅
