# Work Queue Fix - Manual Product Verification Checklist

## Setup

### Start Backend (Port 8001)
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

**Expected**: Server starts on http://127.0.0.1:8001

### Start Frontend (Port 5173)
```powershell
cd frontend
npm run dev
```

**Expected**: Vite dev server starts on http://localhost:5173

---

## Test Case 1: Happy Path (ok_to_ship)

### 1.1 Submit Complete Facility CSF
Navigate to: http://localhost:5173/license-suite/facility

Fill out form with complete data:
- **Facility Name**: Happy Path Facility
- **Account Number**: ACCT-HAPPY-001
- **Pharmacy License Number**: PHOH-12345
- **DEA Number**: BF1234567
- **Pharmacist in Charge**: Dr. Jane Smith
- **Contact Phone**: 555-0123
- **Ship to State**: OH
- **Attestation**: ✅ Checked

Click **Submit**

### 1.2 Check Work Queue
Navigate to: http://localhost:5173/console

Scroll to **Verification Work Queue** section

**Expected**:
- ✅ Item appears in queue
- ✅ Status badge shows **OPEN** (blue color)
- ✅ Title contains "Facility CSF"
- ✅ Subtitle mentions "ok_to_ship" or "Submitted for verification"

### 1.3 Verify Trace Link
Click the **"Open →"** link for the happy-path item

**Expected**:
- ✅ URL changes to `/console?trace={trace_id}` (with actual trace ID)
- ✅ Console page loads (may not show trace viewer yet, but URL is correct)

### 1.4 Verify API Endpoint
Open browser DevTools (F12) → Network tab → Filter by "work-queue"

**Expected**:
- ✅ Request to `/console/work-queue` (NOT `/api/v1/admin/ops/submissions`)
- ✅ Response includes `decision_status: "ok_to_ship"`
- ✅ Response includes non-null `trace_id`

---

## Test Case 2: Blocked Path

### 2.1 Submit Incomplete Facility CSF
Navigate to: http://localhost:5173/license-suite/facility

Fill out form with minimal/missing data:
- **Facility Name**: *(leave empty)*
- **Account Number**: ACCT-BLOCKED-001
- **Pharmacy License Number**: *(leave empty)*
- **DEA Number**: *(leave empty)*
- **Ship to State**: *(leave empty)*
- **Attestation**: ❌ Unchecked

Click **Submit**

### 2.2 Check Work Queue
Navigate to: http://localhost:5173/console

Scroll to **Verification Work Queue** section

**Expected**:
- ✅ Item appears in queue
- ✅ Status badge shows **BLOCKED** (red color)
- ✅ Title contains "Facility CSF"
- ✅ Subtitle contains "Blocked:" with reason

### 2.3 Verify Trace Link
Click the **"Open →"** link for the blocked item

**Expected**:
- ✅ URL changes to `/console?trace={DIFFERENT_trace_id}`
- ✅ Trace ID is different from happy-path item
- ✅ Console page loads

### 2.4 Verify API Endpoint
In browser DevTools → Network tab → Look at `/console/work-queue` response

**Expected**:
- ✅ Response includes `decision_status: "blocked"`
- ✅ Response includes non-null `trace_id` (different from first item)

---

## Test Case 3: Queue Statistics

### 3.1 Check Queue Counts
On Compliance Console page, look at **Verification Work Queue** counters

**Expected**:
- ✅ **Total**: 2 (or more if other items exist)
- ✅ **Needs Review**: At least 1 (the OPEN item)
- ✅ **Blocked**: At least 1 (the BLOCKED item)

### 3.2 Verify Table Display
Look at the work queue table

**Expected**:
- ✅ Both items visible in table
- ✅ Status column shows different colors (blue vs red)
- ✅ Source column shows "CSF"
- ✅ Action column has "Open →" link for both

---

## Test Case 4: Endpoint Validation

### 4.1 Direct API Test
Open new browser tab and navigate to:
```
http://127.0.0.1:8001/console/work-queue
```

**Expected**:
- ✅ JSON response with `items`, `statistics`, `total`
- ✅ Items array contains 2+ submissions
- ✅ Each item has `decision_status` field
- ✅ Each item has `trace_id` field (non-null)
- ✅ Each item has `csf_type: "facility"`

### 4.2 Verify Old Endpoint Still Works (backward compatibility)
Navigate to:
```
http://127.0.0.1:8001/api/v1/admin/ops/submissions
```

**Expected**:
- ✅ Endpoint still responds (not used by frontend, but exists)
- ✅ Returns similar data structure

---

## Validation Checklist

### Backend ✅
- [ ] Server starts on port 8001
- [ ] `/console/work-queue` endpoint returns submissions
- [ ] `decision_status` field present in responses
- [ ] `trace_id` field present and non-null

### Frontend ✅
- [ ] Server starts on port 5173
- [ ] Facility CSF form submits successfully
- [ ] Verification Work Queue displays items
- [ ] Status badges show correct colors (OPEN = blue, BLOCKED = red)
- [ ] "Open →" links include `?trace={trace_id}` parameter

### Integration ✅
- [ ] Happy-path CSF shows status = OPEN
- [ ] Blocked CSF shows status = BLOCKED
- [ ] Each item has unique trace_id
- [ ] Clicking "Open →" navigates to correct trace URL
- [ ] DevTools shows requests to `/console/work-queue` (not `/api/v1/admin/ops/submissions`)

---

## Troubleshooting

### Frontend not fetching from correct endpoint
**Symptom**: DevTools shows requests to `/api/v1/admin/ops/submissions`  
**Fix**: Clear browser cache, hard reload (Ctrl+Shift+R)

### Status shows as RESOLVED instead of OPEN
**Symptom**: Happy-path item shows RESOLVED badge  
**Fix**: Check `verificationWorkEvent.ts` status mapping (should be fixed in this PR)

### Trace link goes to `/console` without trace parameter
**Symptom**: URL is `/console` instead of `/console?trace={id}`  
**Fix**: Check `fromCSFArtifact` link generation (should be fixed in this PR)

### No items in work queue
**Symptom**: Queue is empty after submission  
**Fix**: Check backend logs for errors, verify submission created in `/console/work-queue` response

---

## Success Criteria

All of the following must be true:

1. ✅ Happy-path CSF submission shows **OPEN** status in work queue
2. ✅ Blocked CSF submission shows **BLOCKED** status in work queue
3. ✅ Trace links include `?trace={trace_id}` parameter
4. ✅ Each work queue item has unique, non-null trace_id
5. ✅ Frontend calls `/console/work-queue` endpoint (verified in DevTools)
6. ✅ No requests to `/api/v1/admin/ops/submissions` from VerificationWorkQueue component

If all criteria pass, the fix is **READY FOR PRODUCTION** ✅
