# Backend Integration Manual Test Guide

## Setup

### 1. Start Backend (Terminal 1)
```powershell
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend
.venv\Scripts\python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
```

**Expected:**
```
INFO:     Uvicorn running on http://127.0.0.1:8001
INFO:     Application startup complete.
```

### 2. Verify Backend Health
```powershell
# Terminal 2
curl http://localhost:8001/workflow/health
```

**Expected:** `{"ok":true}`

### 3. Start Frontend (Terminal 3)
```powershell
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\frontend
npm run dev
```

**Expected:**
```
VITE v5.x.x ready in xxx ms
-> Local: http://localhost:5173/
```

---

## TEST 1: Backend Mode (Connected)

### Steps:
1. Open http://localhost:5173
2. Navigate to **CSF Practitioner** form
3. Fill out form and click **Submit**
4. Open browser DevTools (F12)

### Browser Console Checks:
- ✓ `[SubmissionIntake] Using backend API to create case`
- ✓ `[SubmissionIntake] Created case via backend: case_xxxxx`
- ✓ `[SubmissionIntake] Attached evidence via backend: N`

### Network Tab Checks:
- ✓ `POST /submissions` → 200 OK
- ✓ `POST /workflow/cases` → 200 OK
- ✓ `POST /workflow/cases/{id}/evidence/attach` → 200 OK

### UI Checks:
5. Click **"Open Case"** button
   - ✓ Navigates to Console with case selected

6. Verify case details:
   - ✓ Status is **"NEW"** or **"NEEDS_REVIEW"**
   - ✓ SLA due date is set
   - ✓ Timeline tab shows audit events
   - ✓ Evidence tab shows RAG evidence
   - ✓ Submission tab shows form data

7. **Refresh page** (F5)
   - ✓ Case still visible (backend persistence)

---

## TEST 2: Status & Assignment Updates

### Steps:
1. In Console, select the case
2. Change status to **"In Review"**
   - ✓ Status updates immediately

3. **Refresh page** (F5)
   - ✓ Status change persists

4. Assign case to a reviewer
   - ✓ Assignment shows immediately

5. **Refresh page** (F5)
   - ✓ Assignment persists

6. Check **Timeline** tab
   - ✓ Shows audit events for status change
   - ✓ Shows audit events for assignment

7. Select evidence items for packet
8. **Refresh page** (F5)
   - ✓ Evidence selection persists

---

## TEST 3: LocalStorage Fallback (Offline Mode)

### Steps:
1. In backend terminal, press **Ctrl+C** to stop server
   - ✓ Backend stops

2. In browser, **refresh page** (F5)
   - ✓ App continues working (no errors)

3. Submit a new **CSF Practitioner** form

### Browser Console Checks:
- ✓ `[SubmissionIntake] Backend unavailable, using localStorage`
- ✓ `[SubmissionIntake] Created case via localStorage: case_xxxxx`

### Network Tab Checks:
- ✓ `POST /workflow/health` → Failed (timeout or 404)
- ✓ No `POST /submissions`
- ✓ No `POST /workflow/cases`

### UI Checks:
4. Click **"Open Case"**
   - ✓ Navigates to Console with case

5. Verify case appears in work queue
   - ✓ Status set correctly
   - ✓ SLA due date set

6. Check **Timeline** tab
   - ✓ Shows 3 audit events: SUBMITTED, NOTE_ADDED (case created), NOTE_ADDED (evidence)

7. **Refresh page** (F5)
   - ✓ Case persists in localStorage

---

## TEST 4: Failover Behavior

### Steps:
1. **Restart backend** server
   - ✓ Backend running again

2. **Refresh frontend**
   - ✓ Health check succeeds

3. Submit a new form
   - ✓ Console shows **"Using backend API"**
   - ✓ Case created in backend

4. Note the case count in Console

5. **Stop backend** again

6. Submit another form
   - ✓ Console shows **"Backend unavailable"**
   - ✓ Case created in localStorage

7. **Restart backend**

8. **Refresh page**
   - ✓ Backend cases visible
   - ✓ LocalStorage-only case may not be visible (**expected**)

**NOTE:** Cases created in localStorage while backend was down are **not synced** to backend when it comes back online. This is expected behavior.

---

## TEST 5: Deep Links

### Steps:
1. Submit a form (backend mode)
2. Click **"Open Case"** button
   - ✓ URL changes to `/console` with case selected

3. Copy the case ID from URL or case details
4. Navigate to: `/rag?mode=connected&caseId={caseId}`
   - ✓ RAG page loads with case context

5. Click breadcrumb link back to Console
   - ✓ Returns to Console with case selected

6. **Refresh page**
   - ✓ Case details persist

---

## Summary

### ✅ All Tests Complete

- [x] Backend mode: Submissions and cases created via API
- [x] Backend mode: Evidence persisted via API
- [x] Backend mode: Data persists after refresh
- [x] Status and assignment updates persist
- [x] Audit timeline shows events
- [x] LocalStorage fallback works when backend unavailable
- [x] Failover between modes works correctly
- [x] Deep links work in both modes

### Notes
- Backend uses **in-memory storage** (data lost on restart)
- LocalStorage data persists in browser
- No automatic sync between backend and localStorage
- Health check timeout is **2 seconds**

### Cleanup
```powershell
# Stop backend (Terminal 1): Ctrl+C
# Stop frontend (Terminal 3): Ctrl+C
```
