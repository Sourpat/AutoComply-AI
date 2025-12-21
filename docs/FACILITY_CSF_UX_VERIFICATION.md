# Facility CSF Sandbox - UX Verification Guide

**Status:** ✅ All critical fixes applied  
**Date:** 2025-01-XX  
**Scope:** End-to-end UX improvements, backend enum fix, RAG normalization, submission flow

---

## 🎯 Objectives Completed

This document verifies the comprehensive Facility CSF Sandbox improvements to match Hospital and Practitioner sandbox quality standards.

### Fixed Issues

1. **Backend 422 Errors**
   - ✅ Added `"facility"` to `CsfType` enum in `csf_explain.py`
   - ✅ Normalized `regulatory_references` from objects to string arrays in frontend
   - ✅ Both `/csf/explain` and `/rag/regulatory-explain` now accept Facility CSF payloads

2. **Missing Submission Flow**
   - ✅ Added backend submission endpoints (POST `/csf/facility/submit`, GET `/csf/facility/submissions/{id}`)
   - ✅ Added frontend submission button with success/error UI
   - ✅ In-memory submission store (future: database integration)

3. **UX Inconsistencies**
   - ✅ Updated test banner to emerald style (matches Practitioner/Hospital)
   - ✅ Scenario pills with blue highlighting already present
   - ✅ Improved mock order trace button labels ("Simulate Order Approval")

4. **Copilot Staleness Tracking**
   - ✅ Added staleness detection when form or controlled substances change
   - ✅ Amber warning banner appears when copilot results are stale
   - ✅ Auto-clears copilot state on scenario changes

5. **Developer-Only UI Gating**
   - ✅ Added `VITE_SHOW_DEV_INFO` environment flag
   - ✅ Gated: Source document chips, endpoint references, developer trace JSON

---

## 🧪 Verification Steps

### 1. Backend Enum Fix (CsfType)

**Test: `/csf/explain` endpoint accepts "facility" csf_type**

```bash
curl -X POST "http://localhost:8000/csf/explain" \
  -H "Content-Type: application/json" \
  -d '{
    "csf_type": "facility",
    "decision_status": "ok_to_ship",
    "decision_reason": "All required facility information provided",
    "missing_fields": [],
    "regulatory_references": ["csf_facility_form"]
  }'
```

**Expected:** 200 OK with `plain_english` explanation  
**Before fix:** 422 Unprocessable Entity (enum validation error)

---

### 2. RAG Regulatory Explain (regulatory_references normalization)

**Test: `/rag/regulatory-explain` endpoint accepts Facility CSF context**

```bash
curl -X POST "http://localhost:8000/rag/regulatory-explain" \
  -H "Content-Type: application/json" \
  -d '{
    "csf_type": "facility",
    "question": "What are the facility DEA registration requirements?",
    "regulatory_references": ["csf_facility_form", "dea_handbook"],
    "missing_fields": [],
    "decision_status": "ok_to_ship"
  }'
```

**Expected:** 200 OK with `answer` and `sources` array  
**Before fix:** 422 error due to `csf_type` enum mismatch or malformed `regulatory_references`

---

### 3. Submission Flow

**Test: POST submission and retrieve by ID**

```bash
# Step 1: Submit for verification
curl -X POST "http://localhost:8000/csf/facility/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "facility_name": "SummitCare Clinics – East Region",
    "account_number": "ACCT-445210",
    "decision_status": "ok_to_ship",
    "copilot_used": true
  }'
```

**Expected Response:**
```json
{
  "submission_id": "sub_abc123xyz",
  "facility_name": "SummitCare Clinics – East Region",
  "account_number": "ACCT-445210",
  "status": "ok_to_ship",
  "copilot_used": true,
  "submitted_at": "2025-01-XX 14:35:22"
}
```

```bash
# Step 2: Retrieve submission by ID
curl -X GET "http://localhost:8000/csf/facility/submissions/sub_abc123xyz"
```

**Expected:** 200 OK with matching submission data  
**Before fix:** Endpoints did not exist

---

### 4. Frontend UX Verification

#### 4.1 Test Banner (Emerald Style)

**Location:** Top of Facility CSF Sandbox page  
**Visual Check:**
- Background: `bg-emerald-50` (light green tint)
- Border: `border-emerald-200`
- Text: `text-emerald-800`
- Icon: Green checkmark ✓
- Content: "All 3 Facility CSF backend tests passing"

**Before:** Low-contrast purple banner  
**After:** High-contrast emerald banner matching Practitioner/Hospital

---

#### 4.2 Scenario Pills (Already Present)

**Location:** Below test banner  
**Visual Check:**
- Unselected: White border, transparent background
- Selected: Blue highlighted (`bg-blue-50`, `border-blue-500`, `text-blue-700`)
- Pills: "Facility CSF complete", "Missing info", "Non-compliance"

**Status:** Already correct (no changes needed)

---

#### 4.3 Copilot Staleness Tracking

**Test Steps:**

1. **Load Scenario 1** (Facility CSF complete)
2. **Run Copilot** ("Check & Explain" button)
   - ✅ Copilot results display
   - ✅ No staleness warning
3. **Change any form field** (e.g., facility name)
   - ✅ Amber warning banner appears:
     > ⚠️ Form has changed since last copilot analysis. Click "Check & Explain" for updated guidance.
4. **Switch to Scenario 2**
   - ✅ Copilot results auto-clear
   - ✅ Staleness warning disappears
5. **Add/remove controlled substance**
   - ✅ Copilot state clears

**Before:** Stale copilot results persisted after form changes  
**After:** Staleness detection with clear visual warning

---

#### 4.4 Submission Flow (Frontend)

**Test Steps:**

1. **Load Scenario 1** and click "Evaluate"
2. **Verify decision shows** (status badge visible)
3. **Click "Submit for Verification"** button
   - ✅ Button disables during request
   - ✅ Success message appears:
     > ✅ Submitted successfully!  
     > Submission ID: sub_xyz123abc
4. **Error case:** Trigger API error (e.g., disconnect backend)
   - ✅ Error message displays in red text

**Before:** No submission button or flow  
**After:** Complete submission UI with success/error states

---

#### 4.5 Mock Order Trace UX

**Location:** Ohio mock order section (bottom of page)

**Visual Check:**
- Button label: "Simulate Order Approval" (not "Run mock order trace")
- Loading state: "Simulating order approval…"
- Description: "Combines Facility CSF decision + Ohio TDDD result to simulate final order approval."

**Before:** Confusing "trace" terminology  
**After:** Clear "Simulate Order Approval" language

---

#### 4.6 Developer-Only UI Gating

**Test: Without `VITE_SHOW_DEV_INFO=true` in environment**

**Hidden Elements (should NOT appear):**
- ✅ Source document chip ("Facility CSF PDF")
- ✅ Endpoint references (e.g., "Result from /orders/mock/ohio-facility-approval")
- ✅ "Developer trace" section with raw JSON payload/response
- ✅ API reference hint text

**Test: With `VITE_SHOW_DEV_INFO=true` in `.env`**

**Visible Elements:**
- ✅ Source document chip appears in header
- ✅ Endpoint references visible in mock order results
- ✅ "Developer trace" section shows full JSON

**Implementation:** `const SHOW_DEV_INFO = import.meta.env.VITE_SHOW_DEV_INFO === "true";`

---

## 🧪 Backend Test Coverage

**File:** `backend/tests/test_csf_facility_api.py`

### New Tests Added

1. **`test_facility_csf_explain_endpoint`**
   - Validates `/csf/explain` accepts `"facility"` csf_type
   - Checks `plain_english` explanation is returned

2. **`test_facility_csf_rag_regulatory_explain`**
   - Validates `/rag/regulatory-explain` with Facility context
   - Verifies `answer` and `sources` returned

3. **`test_facility_csf_submit_endpoint`**
   - POST submission returns `submission_id` and `submitted_at`
   - Validates submission payload structure

4. **`test_facility_csf_get_submission_endpoint`**
   - GET retrieves submission by ID
   - Confirms data integrity (facility name, account number, status)

### Running Tests

```bash
cd backend
pytest tests/test_csf_facility_api.py -v
```

**Expected Output:**
```
test_facility_csf_scenario_1_complete_acceptable PASSED
test_facility_csf_scenario_2_missing_critical_info PASSED
test_facility_csf_scenario_3_high_risk_responses PASSED
test_facility_csf_explain_endpoint PASSED
test_facility_csf_rag_regulatory_explain PASSED
test_facility_csf_submit_endpoint PASSED
test_facility_csf_get_submission_endpoint PASSED
```

---

## 📁 Modified Files Summary

### Backend Changes

1. **`backend/src/autocomply/domain/csf_explain.py`**
   - Added `FACILITY = "facility"` to `CsfType` enum (line 13)
   - Added `"facility": "Facility CSF"` to `type_label_map` (line 19)

2. **`backend/src/api/routes/csf_facility.py`**
   - Added `FACILITY_SUBMISSION_STORE` in-memory dict (line 20)
   - Added `SubmissionResponse` Pydantic model (lines 22-29)
   - Added POST `/csf/facility/submit` endpoint (lines 31-55)
   - Added GET `/csf/facility/submissions/{submission_id}` endpoint (lines 58-65)

3. **`backend/tests/test_csf_facility_api.py`**
   - Added 4 new test functions for explain/RAG/submit endpoints (lines 194-285)

### Frontend Changes

**`frontend/src/components/FacilityCsfSandbox.tsx`** (multiple sections updated):

1. **Lines 40-42:** Added `SHOW_DEV_INFO` environment flag
2. **Lines 261-299:** Added copilot staleness state and helpers
3. **Lines 468-476:** Updated `onChange` to clear copilot state
4. **Lines 410-418:** Updated `applyFacilityExample` to clear copilot
5. **Lines 570-598:** Normalized `regulatory_references` in `handleExplain`
6. **Lines 622-670:** Added `handleSubmitForVerification` function
7. **Lines 645:** Store copilot payload after successful run
8. **Lines 740-756:** Updated test banner to emerald style
9. **Lines 847-849:** Gated source document chip with `SHOW_DEV_INFO`
10. **Lines 1032-1074:** Added submission button with success/error UI
11. **Lines 1060-1083:** Normalized `regulatory_references` in RAG calls
12. **Lines 1380-1389:** Added staleness warning banner in copilot UI
13. **Lines 1530-1542:** Improved mock order button labels
14. **Lines 1555-1563:** Gated endpoint display with `SHOW_DEV_INFO`
15. **Lines 1569-1577:** Gated API reference hint with `SHOW_DEV_INFO`
16. **Lines 1590-1618:** Gated developer trace section with `SHOW_DEV_INFO`
17. **Lines 1621-1631:** Wrapped `setControlledSubstances` to clear copilot

---

## 🔧 Environment Setup

### `.env` Configuration (Optional Dev UI)

```bash
# Frontend .env (in frontend/ directory)
VITE_API_BASE=http://localhost:8000
VITE_SHOW_DEV_INFO=true  # Set to "true" to show developer-only UI
```

**Default (production):** Dev UI elements hidden  
**With flag:** Source chips, endpoint refs, trace JSON visible

---

## ✅ Acceptance Criteria

- [x] Backend `/csf/explain` accepts `"facility"` without 422 error
- [x] Backend `/rag/regulatory-explain` accepts Facility CSF context
- [x] Frontend normalizes `regulatory_references` before API calls
- [x] Submission endpoints (POST/GET) functional with in-memory store
- [x] Frontend submission button shows success with submission ID
- [x] Test banner uses emerald style (high contrast)
- [x] Copilot staleness tracking clears on form/scenario changes
- [x] Copilot staleness warning banner displays when stale
- [x] Mock order trace button labeled "Simulate Order Approval"
- [x] Developer-only UI gated behind `VITE_SHOW_DEV_INFO` flag
- [x] All backend tests passing (7 total in test_csf_facility_api.py)

---

## 🚀 Future Enhancements

1. **Database Persistence**
   - Replace `FACILITY_SUBMISSION_STORE` in-memory dict with PostgreSQL/SQLite
   - Add submission history UI panel

2. **Submission Status Tracking**
   - Add `verification_status` field (`pending`, `approved`, `rejected`)
   - Email notifications on status changes

3. **Copilot Payload Storage**
   - Store full copilot payload in submission for audit trail
   - Add "View Copilot Analysis" button in submission history

4. **RAG Source Citations**
   - Link regulatory references to specific document sections
   - Add inline citation tooltips in copilot explanations

---

## 📞 Support

For issues or questions about Facility CSF Sandbox:
- Backend tests: `pytest backend/tests/test_csf_facility_api.py -v`
- Frontend dev server: `cd frontend && npm run dev`
- Check browser console for frontend errors
- Verify `.env` variables are set correctly

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Verified By:** GitHub Copilot (Claude Sonnet 4.5)
