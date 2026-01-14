# Step 2.8 Verification Guide
**End-to-End Submission → Case Creation → Connected RAG Evidence**

---

## Quick Start

### 1. Start Development Servers
```powershell
# Terminal 1 - Backend
cd backend
.\.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. Open Application
Navigate to: `http://localhost:5173`

---

## Complete Verification Checklist

### ✅ Part 1: CSF Form Submission

#### Test: Submit CSF Practitioner Application

1. **Navigate to Form**
   - [ ] Go to `/csf-practitioner` page
   - [ ] Verify form loads with all fields visible

2. **Fill Out Form** (Use Preset)
   - [ ] Click "Load Preset" dropdown
   - [ ] Select "Dr. Sarah Chen - Approved"
   - [ ] Verify all fields populate correctly

3. **Submit Application**
   - [ ] Click "Submit Application" button
   - [ ] Verify success banner appears at top
   - [ ] Banner should show: "Application submitted successfully!"
   - [ ] Verify "Open Case in Console" button is visible

---

### ✅ Part 2: Case Creation & Navigation

4. **Navigate to Console**
   - [ ] Click "Open Case in Console" button
   - [ ] Verify navigation to `/console`
   - [ ] Verify case is auto-selected in right panel

5. **Verify Case in Queue**
   - [ ] New case appears in left sidebar work queue
   - [ ] Case title matches submission (e.g., "Dr. Sarah Chen - Approved")
   - [ ] Case status shows as **"NEW"** (or similar initial status)
   - [ ] Case shows **SLA due date** (e.g., "Due in 23h 45m")
   - [ ] Case shows correct priority badge (color-coded)

---

### ✅ Part 3: Case Details - Timeline Tab

6. **Open Timeline Tab**
   - [ ] Click on the case in left sidebar to open details
   - [ ] Click "Timeline" tab
   - [ ] Verify timeline contains these events (in order):

   **Expected Timeline Events:**
   - [ ] **SUBMISSION_RECEIVED** - "Submission received from Dr. Sarah Chen"
   - [ ] **CASE_CREATED** - "Case created and queued for review"
   - [ ] **EVIDENCE_ATTACHED** - "Attached X regulatory evidence documents"

   **Verify Event Details:**
   - [ ] Each event shows timestamp
   - [ ] Each event shows actor name
   - [ ] Events are ordered chronologically (newest first)

---

### ✅ Part 4: Case Details - Evidence Tab

7. **Verify Evidence Attachment**
   - [ ] Click "Evidence" tab
   - [ ] Verify evidence items are displayed
   - [ ] Each evidence item should show:
     - Document title
     - Jurisdiction (e.g., "Ohio", "Federal")
     - Citation (e.g., "OAC 4723-9-10")
     - Snippet/excerpt text
     - Confidence score (if available)

   **Expected Evidence Sources:**
   - [ ] At least 1 evidence document attached
   - [ ] Evidence relates to practitioner CSF requirements
   - [ ] Inclusion checkboxes are visible (for export packet curation)

---

### ✅ Part 5: Case Details - Submission Tab

8. **Verify Submission Data Display**
   - [ ] Click "Submission" tab
   - [ ] Verify submission details are displayed

   **Basic Info Section:**
   - [ ] Submission ID (UUID format)
   - [ ] Submitted At (timestamp)
   - [ ] Decision Type (e.g., "CSF_PRACTITIONER")
   - [ ] Submitted By (user name or email)
   - [ ] Evaluator Status (if available)
   - [ ] Risk Level (if available)

   **Form Data Section:**
   - [ ] Table displays all form fields as key/value pairs
   - [ ] Keys are readable (underscores replaced with spaces)
   - [ ] Values match submitted data (check a few fields)
   - [ ] Object values are formatted as JSON strings

   **Evaluator Output Section:**
   - [ ] Explanation text (if available)
   - [ ] Confidence percentage (if available)
   - [ ] Trace ID (if available)

   **Raw Payload Section:**
   - [ ] "Raw Payload JSON" collapsible is visible
   - [ ] Click to expand - shows formatted JSON
   - [ ] JSON is properly indented and readable

---

### ✅ Part 6: Connected RAG Integration

9. **Test RAG Explorer Connection**
   - [ ] In case details, find "Open in RAG Explorer" button (or similar)
   - [ ] Click to open RAG Explorer
   - [ ] Verify URL includes `mode=connected&caseId={caseId}`
   - [ ] RAG Explorer loads with case context
   - [ ] Case ID is displayed in UI
   - [ ] Can query for evidence related to case

---

### ✅ Part 7: Other Case Tabs

10. **Verify Remaining Tabs Work**

**Summary Tab:**
- [ ] Click "Summary" tab
- [ ] Shows case overview (title, status, priority, SLA)
- [ ] Shows risk level and decision summary (if available)
- [ ] Action buttons work (Approve, Request Info, etc.)

**Playbook Tab:**
- [ ] Click "Playbook" tab
- [ ] Loads "CSF Practitioner Review Playbook"
- [ ] Shows 12 steps with descriptions
- [ ] Action buttons work (Request Info, etc.)
- [ ] Step completion can be toggled

**Explainability Tab:**
- [ ] Click "Explainability" tab
- [ ] RAG query interface is visible
- [ ] Can enter question and get regulatory guidance
- [ ] Evidence sources are displayed
- [ ] Can toggle "connected mode" if desired

**Notes Tab:**
- [ ] Click "Notes" tab
- [ ] Can add internal reviewer notes
- [ ] Notes persist after refresh
- [ ] Shows author and timestamp

**Attachments Tab:**
- [ ] Click "Attachments" tab
- [ ] Can upload files (demo-safe, localStorage)
- [ ] Attachments list shows uploaded files

---

## Edge Cases & Error Handling

### Test: Missing Submission Data

11. **Create Case Without Submission**
   - [ ] Manually create a work queue item without `submissionId`
   - [ ] Open case in Console
   - [ ] Click "Submission" tab
   - [ ] Verify empty state message: "No submission data available for this case"

### Test: RAG API Unavailable

12. **Simulate RAG Failure**
   - [ ] Stop backend server (if using RAG API)
   - [ ] Submit CSF form
   - [ ] Case should still be created
   - [ ] Timeline should show case_created event
   - [ ] Evidence tab may be empty or show error message
   - [ ] Submission tab should still work

---

## Performance Checks

### Bundle Size
- [ ] Run `npm run build` in frontend
- [ ] Verify bundle size ~740 kB (gzipped ~180 kB)
- [ ] No significant increase from baseline

### Loading Speed
- [ ] Case loads in < 500ms
- [ ] Submission tab renders instantly
- [ ] No console errors or warnings

---

## TypeScript Compilation

### Build Verification
```powershell
cd frontend
npm run build
```

- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Vite build passes

---

## Common Issues & Fixes

### Issue: Case Not Appearing in Queue
**Fix:** Check browser console for errors, verify submissionStore has data:
```javascript
localStorage.getItem('acai.submissions.v1')
```

### Issue: Submission Tab Shows Empty
**Fix:** Verify case has `submissionId` field set. Check demoStore:
```javascript
localStorage.getItem('acai.workQueue.v1')
```

### Issue: Evidence Not Attached
**Fix:** Verify RAG API is running on port 8001:
```powershell
netstat -ano | Select-String ":8001"
```

### Issue: Timeline Events Missing
**Fix:** Check auditEvents in demoStore:
```javascript
localStorage.getItem('acai.auditEvents.v1')
```

---

## Clean Slate Reset

To reset all demo data and start fresh:

```javascript
// In browser console
localStorage.clear();
location.reload();
```

Then resubmit a CSF form to generate new data.

---

## Success Criteria Summary

✅ **Step 2.8 is COMPLETE when:**

1. CSF form submission creates submission record
2. Submission intake creates work queue case
3. Case appears immediately in Console queue
4. Timeline shows 3+ audit events (submission_received, case_created, evidence_attached)
5. Evidence tab shows auto-attached RAG evidence
6. Submission tab displays complete form data
7. All case tabs work (Summary, Playbook, Explainability, Notes, Attachments)
8. "Open Case" CTA navigates to Console with case selected
9. No TypeScript errors in build
10. Code is demo-safe (localStorage only, no external deps)

---

## Next Steps

After verification:
- [ ] Document any bugs found
- [ ] Create GitHub issues for enhancements
- [ ] Begin Step 2.9 (if applicable)
- [ ] Update project README with new features

---

**Last Updated:** 2026-01-07  
**Build:** frontend@0.0.0 (Vite 5.4.21)  
**Bundle:** 738.61 kB (gzipped: 180.16 kB)
