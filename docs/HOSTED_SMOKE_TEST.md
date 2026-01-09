# Hosted Deployment Smoke Test

**Purpose**: Verify production deployment is working correctly  
**Duration**: 5-10 minutes  
**When**: After deploying to Render, Vercel, Netlify, or other hosting platforms

---

## Prerequisites

- Frontend deployed and accessible
- Backend deployed and accessible
- CORS configured correctly (`CORS_ORIGINS` set to frontend URL)
- Environment variables set:
  - Backend: `APP_ENV=prod`, `CORS_ORIGINS=<frontend-url>`
  - Frontend: `VITE_API_BASE_URL=<backend-url>`

---

## Expected URLs

Replace these placeholders with your actual deployment URLs:

```
Frontend URL: https://autocomply-frontend.onrender.com
Backend URL:  https://autocomply-backend.onrender.com
```

Or use custom domains:
```
Frontend URL: https://autocomply.yourdomain.com
Backend URL:  https://api.autocomply.yourdomain.com
```

---

## Test Checklist

### 1. Frontend Page Loads

**Test**: Verify all main pages load without errors

#### Home Page
- [ ] Navigate to: `https://autocomply-frontend.onrender.com`
- [ ] Expected: Home page loads with hero section
- [ ] Check: No console errors in browser DevTools
- [ ] Check: Nav bar shows: Home, Chat, CSF, License, Console, Coverage, Analytics

#### Console Page
- [ ] Navigate to: `https://autocomply-frontend.onrender.com/console`
- [ ] Expected: Compliance Console loads with engine cards
- [ ] Check: All CSF cards visible (Hospital, Facility, Practitioner, EMS, Researcher)
- [ ] Check: License validation cards visible (Ohio TDDD, NY Pharmacy)
- [ ] Check: System status card shows backend connectivity

#### CSF Overview Page
- [ ] Navigate to: `https://autocomply-frontend.onrender.com/csf`
- [ ] Expected: CSF overview page loads with work queue
- [ ] Check: Journey panels visible (Hospital CSF, NY Pharmacy)
- [ ] Check: No HTTP 500 errors
- [ ] Check: Work queue table renders (may be empty)

#### Coverage Dashboard
- [ ] Navigate to: `https://autocomply-frontend.onrender.com/coverage`
- [ ] Expected: Coverage analytics dashboard loads
- [ ] Check: Form coverage metrics visible
- [ ] Check: Geographic coverage chart visible
- [ ] Check: Saved views section loads

#### Analytics Dashboard
- [ ] Navigate to: `https://autocomply-frontend.onrender.com/analytics`
- [ ] Expected: Analytics views page loads
- [ ] Check: View selector dropdown works
- [ ] Check: Can create new saved view
- [ ] Check: Export buttons visible

---

### 2. Backend Health Check

**Test**: Verify backend API is accessible and healthy

#### Health Endpoint
- [ ] Open browser or use curl:
  ```bash
  curl https://autocomply-backend.onrender.com/health
  ```
- [ ] Expected response:
  ```json
  {
    "status": "healthy",
    "version": "0.1.0",
    "timestamp": "2026-01-08T12:34:56.789Z",
    "database": "connected",
    "kb_entries": 52
  }
  ```
- [ ] Check: Status is `"healthy"`
- [ ] Check: Database is `"connected"`
- [ ] Check: KB entries count > 0 (should be ~52 if seeded)

#### Workflow Health Endpoint
- [ ] Open browser or use curl:
  ```bash
  curl https://autocomply-backend.onrender.com/api/v1/workflow/health
  ```
- [ ] Expected response:
  ```json
  {
    "status": "ok",
    "workflow_version": "2.0",
    "features": ["submissions", "exports", "analytics"]
  }
  ```
- [ ] Check: Status is `"ok"`
- [ ] Check: Features array includes expected items

---

### 3. CORS Verification

**Test**: Ensure frontend can communicate with backend

#### Browser DevTools Check
- [ ] Navigate to: `https://autocomply-frontend.onrender.com`
- [ ] Open DevTools (F12) → Network tab
- [ ] Refresh page
- [ ] Check: API requests to backend show status 200 (not CORS errors)
- [ ] Check: No `Access-Control-Allow-Origin` errors in console

#### Manual CORS Test
- [ ] Navigate to: `https://autocomply-frontend.onrender.com/console`
- [ ] Open browser console
- [ ] Run:
  ```javascript
  fetch('/api/health')
    .then(r => r.json())
    .then(data => console.log('Backend health:', data))
    .catch(err => console.error('CORS error:', err));
  ```
- [ ] Expected: Logs backend health object
- [ ] Check: No CORS errors

---

### 4. End-to-End Workflow Test

**Test**: Submit CSF form → View in console → Export packet

#### Step 1: Submit Hospital CSF Form

- [ ] Navigate to: `https://autocomply-frontend.onrender.com/csf`
- [ ] Click "Hospital CSF" journey panel
- [ ] Fill out form:
  - Hospital Name: `Riverside General Hospital`
  - Account Number: `ACCT-123456`
  - Ship-to State: `Ohio` (select from dropdown)
  - Attestation: Check "I accept" checkbox
- [ ] Click "Evaluate Hospital CSF"
- [ ] Expected: Decision appears (likely `ok_to_ship`)
- [ ] Check: Decision badge shows green/blue/red color
- [ ] Check: Regulatory references listed

#### Step 2: Verify Case in Console

- [ ] Navigate to: `https://autocomply-frontend.onrender.com/console`
- [ ] Scroll to "Recent Decisions" panel (if visible)
- [ ] Check: Hospital CSF submission appears in recent activity
- [ ] **OR** navigate to: `https://autocomply-frontend.onrender.com/csf`
- [ ] Check: Work queue shows new case row
- [ ] Note the Case ID (e.g., `CSF-HOSP-001`)

#### Step 3: Open Case Detail

- [ ] In work queue, click on the case row (or click "View" button)
- [ ] Expected: Case detail panel/page opens
- [ ] Check: Case metadata visible:
  - Case ID
  - Submission timestamp
  - Status (submitted, verified, approved, etc.)
  - Jurisdiction (Ohio)
  - Decision (ok_to_ship, needs_review, blocked)
- [ ] Check: Form data section shows submitted values:
  - Hospital Name: Riverside General Hospital
  - Account Number: ACCT-123456
  - Ship-to State: OH

#### Step 4: Evidence Drawer/Timeline

- [ ] In case detail view, look for:
  - "Evidence" tab/drawer
  - "Timeline" tab
  - "Audit Trail" section
- [ ] Click to open evidence/timeline
- [ ] Expected: Shows audit events:
  - Case submitted
  - Form evaluated
  - Decision recorded
- [ ] Check: Each event has:
  - Timestamp
  - Actor (e.g., "submitter", "system")
  - Event type
  - Before/after state (for status changes)

#### Step 5: Export Packet

- [ ] In case detail view or work queue, look for "Export" button
- [ ] **Option A**: Export single case
  - Click "Export" or "Download Packet" button
  - Expected: CSV or JSON file downloads
  - Check: File contains case data
  
- [ ] **Option B**: Bulk export from analytics
  - Navigate to: `https://autocomply-frontend.onrender.com/coverage`
  - Click "Export to CSV" button
  - Expected: CSV file downloads with all cases
  - Check: File is not empty
  - Check: Headers include: case_id, form_type, jurisdiction, status, decision

---

### 5. Chat Interface Test (Optional)

**Test**: Verify RAG chat works with backend KB

- [ ] Navigate to: `https://autocomply-frontend.onrender.com/chat`
- [ ] Type question: `What are the requirements for Schedule II in Florida?`
- [ ] Press Enter or click Send
- [ ] Expected: Response appears with:
  - Answer text (regulatory guidance)
  - Source references (KB entries)
  - Confidence score/similarity score
- [ ] Check: No HTTP 500 errors
- [ ] Check: Sources link to KB entry IDs

---

### 6. License Validation Test (Optional)

**Test**: Verify license validation engines work

#### Ohio TDDD License

- [ ] Navigate to: `https://autocomply-frontend.onrender.com/console`
- [ ] Find "Ohio TDDD License" card
- [ ] Click to expand or navigate to form
- [ ] Fill out:
  - License Number: `TDDD-12345`
  - Ship-to State: `Ohio`
  - Effective Date: `2024-01-01`
  - Expiry Date: `2026-12-31`
- [ ] Click "Validate"
- [ ] Expected: Valid license response
- [ ] Check: Expiry status calculated correctly

---

## Troubleshooting

### Frontend Loads But Shows Blank Pages

**Symptom**: Home page loads, but /console or /csf show blank screen

**Check**:
1. Browser console for JavaScript errors
2. DevTools → Network tab for failed API requests
3. CORS errors (backend not allowing frontend origin)
4. `VITE_API_BASE_URL` environment variable set correctly

**Fix**:
- Verify backend `CORS_ORIGINS` includes exact frontend URL
- Rebuild frontend with correct `VITE_API_BASE_URL`

### Backend Health Returns 500 or 404

**Symptom**: `/health` endpoint not responding

**Check**:
1. Backend logs for errors
2. Database file exists (persistent disk mounted)
3. Backend environment variables set correctly

**Fix**:
- Check Render logs for backend service
- Verify persistent disk is mounted at `/opt/render/project/backend/app/data`
- Restart backend service

### CORS Errors in Browser Console

**Symptom**: Console shows `Access-Control-Allow-Origin` errors

**Check**:
1. Backend `CORS_ORIGINS` environment variable
2. Value should be exact frontend URL (no trailing slash)
3. Not using wildcard `*` in production

**Fix**:
```bash
# Set in Render backend environment variables
CORS_ORIGINS=https://autocomply-frontend.onrender.com
```

### Case Submission Works But Not Visible in Queue

**Symptom**: Form submits successfully but case doesn't appear

**Check**:
1. Database write permissions (persistent disk)
2. Backend logs for database errors
3. Frontend API client using correct base URL

**Fix**:
- Check backend logs for SQLite errors
- Verify persistent disk mounted and writable
- Test `/api/v1/workflow/cases` endpoint directly

### Export Downloads Empty File

**Symptom**: Export button triggers download but file is empty

**Check**:
1. Export directory exists (`backend/app/data/exports`)
2. Persistent disk mounted
3. Backend has write permissions

**Fix**:
- Ensure persistent disk mounted at correct path
- Check backend logs for file write errors
- Verify export directory created during startup

---

## Success Criteria

All tests pass if:

✅ All frontend pages load without errors  
✅ Backend health endpoints return 200 OK  
✅ No CORS errors in browser console  
✅ End-to-end workflow completes:
  - Form submission succeeds
  - Case appears in work queue
  - Case detail shows correct data
  - Evidence/timeline displays events
  - Export downloads valid file

---

## Post-Deployment Actions

After smoke test passes:

1. **Document URLs**: Update README.md with production URLs
2. **Test Admin Mode**: Verify admin unlock works (see OPERATOR_GUIDE_PRIVATE.md)
3. **Seed Knowledge Base**: Run KB seed script if not auto-seeded
4. **Monitor Logs**: Check backend logs for any warnings/errors
5. **Set Up Monitoring**: Configure uptime checks (Pingdom, UptimeRobot, etc.)

---

## Quick Copy-Paste Test Commands

Replace `<frontend-url>` and `<backend-url>` with your actual URLs:

```bash
# Backend health
curl https://<backend-url>/health

# Workflow health
curl https://<backend-url>/api/v1/workflow/health

# List cases (should work without auth for read-only)
curl https://<backend-url>/api/v1/workflow/cases

# KB search
curl -X POST https://<backend-url>/api/v1/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Ohio TDDD?"}'
```

---

## Reporting Issues

If smoke test fails:

1. **Capture Details**:
   - URL where error occurred
   - Browser console errors (screenshot or copy text)
   - Network tab showing failed request
   - Backend logs (from Render dashboard)

2. **Check Common Issues**:
   - CORS misconfiguration (most common)
   - `VITE_API_BASE_URL` not set or incorrect
   - Backend not running or crashed
   - Database file missing (persistent disk issue)

3. **Rollback If Needed**:
   - Render: Use "Manual Deploy" → select previous commit
   - Vercel/Netlify: Redeploy previous version

---

**Last Updated**: January 8, 2026  
**Version**: v0.1-demo  
**Next Review**: After any deployment changes
