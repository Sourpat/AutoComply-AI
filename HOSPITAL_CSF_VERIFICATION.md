# Hospital CSF Sandbox - Verification Guide

## Issues Fixed

### 1. ✅ Hospital Form Copilot 404
- **Problem**: Backend imports used `autocomply` instead of `src.autocomply`
- **Fix**: Updated all imports in backend routes and domain files to use correct `src.autocomply` path
- **Files changed**:
  - `backend/src/api/routes/csf_explain.py`
  - `backend/src/api/routes/rag_regulatory.py`
  - `backend/src/autocomply/domain/csf_explain.py`
  - `backend/src/autocomply/domain/rag_regulatory_explain.py`

### 2. ✅ Explain Decision 422 Schema Mismatch
- **Problem**: Frontend sent `regulatory_references` as array of objects, backend expected array of strings
- **Fix**: Updated frontend to extract `id` field from regulatory reference objects before sending
- **Files changed**:
  - `frontend/src/components/HospitalCsfSandbox.tsx` - Transform references to string IDs
  - `frontend/src/api/csfExplainClient.ts` - Updated interface to expect string array

### 3. ✅ Deep RAG Explain 422 Schema Mismatch
- **Problem**: Same as #2 - regulatory_references type mismatch
- **Fix**: Normalize regulatory references to strings before calling RAG endpoint
- **Files changed**:
  - `frontend/src/components/HospitalCsfSandbox.tsx` - Extract IDs from reference objects

### 4. ✅ Input Text Unreadable (White on White)
- **Problem**: Input fields inherited white text color making them invisible
- **Fix**: Set explicit dark text color (#1f2937) and white background for all inputs
- **Files changed**:
  - `frontend/src/index.css` - Added explicit colors for input/textarea/select elements

### 5. ✅ "Ask Codex" Button Does Nothing
- **Problem**: Button had onClick handler but no real implementation
- **Fix**: Disabled button with clear "Coming soon" messaging and tooltip
- **Files changed**:
  - `frontend/src/components/HospitalCsfSandbox.tsx` - Disabled button with appropriate UX

### 6. ✅ API_BASE Configuration
- **Verified**: All API clients import from single source (`csfHospitalClient.ts`)
- **Verified**: API_BASE logs on page load: `[AutoComply] API_BASE = http://127.0.0.1:8000`
- **Verified**: No fallback empty strings that cause same-origin calls

## How to Verify the Fixes

### Prerequisites
1. Backend running on `http://127.0.0.1:8000`
2. Frontend running on `http://localhost:5173`
3. Environment variable set: `VITE_API_BASE=http://127.0.0.1:8000` in `frontend/.env.local`

### Test 1: Hospital Form Copilot (was 404, now should work)

**Steps:**
1. Navigate to Hospital CSF Sandbox page
2. Fill in the form or select a preset (e.g., "Ohio hospital – Schedule II (happy path)")
3. Click "Check & Explain" button in the Form Copilot panel (right side)

**Expected Result:**
- ✅ Status 200 response
- ✅ Decision status displayed (ok_to_ship/needs_review/blocked)
- ✅ Reason text explaining the decision
- ✅ Any missing fields listed
- ✅ No 404 error

**cURL to test directly:**
```bash
curl -X POST http://127.0.0.1:8000/csf/hospital/form-copilot \
  -H "Content-Type: application/json" \
  -d '{
    "facility_name": "Test Hospital",
    "facility_type": "hospital",
    "pharmacy_license_number": "TDDD-123456",
    "dea_number": "DEA-123456",
    "pharmacist_in_charge_name": "Dr. Test",
    "ship_to_state": "OH",
    "attestation_accepted": true,
    "controlled_substances": []
  }'
```

### Test 2: Explain Decision (was 422, now should work)

**Steps:**
1. Complete Test 1 or click "Evaluate Hospital CSF" to get a decision
2. Wait for decision to display
3. Click "Explain decision" button

**Expected Result:**
- ✅ Status 200 response
- ✅ Narrative explanation appears in text box
- ✅ No 422 validation error

**cURL to test directly:**
```bash
curl -X POST http://127.0.0.1:8000/csf/explain \
  -H "Content-Type: application/json" \
  -d '{
    "csf_type": "hospital",
    "decision": {
      "status": "ok_to_ship",
      "reason": "All requirements met",
      "missing_fields": [],
      "regulatory_references": ["csf_hospital_form", "csf_oh_addendum"]
    }
  }'
```

### Test 3: Deep RAG Explain (was 422, now should work)

**Steps:**
1. Have a decision displayed (from Test 1 or 2)
2. Click "Deep RAG explain" button

**Expected Result:**
- ✅ Status 200 response
- ✅ Detailed explanation using regulatory artifacts
- ✅ No 422 validation error

**cURL to test directly:**
```bash
curl -X POST http://127.0.0.1:8000/rag/regulatory-explain \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Explain this hospital CSF decision",
    "regulatory_references": ["csf_hospital_form"],
    "decision": {
      "status": "ok_to_ship",
      "reason": "Test reason"
    }
  }'
```

### Test 4: CSS Readability (was white on white, now readable)

**Steps:**
1. Open Hospital CSF Sandbox
2. Look at any input field (Facility name, DEA #, etc.)
3. Select a preset from dropdown

**Expected Result:**
- ✅ Input text is dark and clearly visible against white background
- ✅ Placeholder text is visible (lighter gray)
- ✅ Preset values are readable when populated
- ✅ All text fields have good contrast

### Test 5: Ask Codex Button (was broken, now disabled with clear UX)

**Steps:**
1. Get a decision displayed
2. Look at "Ask Codex to explain decision" button at bottom of decision panel

**Expected Result:**
- ✅ Button is visually disabled (grayed out, low opacity)
- ✅ Cursor changes to "not-allowed" on hover
- ✅ Hovering shows tooltip: "Coming soon: AI-powered narrative explanations..."
- ✅ Text below button says "Coming soon: narrative explanation..."
- ✅ Clicking does nothing (no errors in console)

### Test 6: Network Tab Verification

**Steps:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Perform any Hospital CSF operation (Evaluate, Form Copilot, Explain, etc.)

**Expected Result:**
- ✅ All API calls go to `http://127.0.0.1:8000/...`
- ✅ NO API calls to `http://localhost:5173/...` (except static assets)
- ✅ Console shows: `[AutoComply] API_BASE = http://127.0.0.1:8000`

## Regression Testing

Ensure no other CSF sandboxes were broken:

1. **Practitioner CSF Sandbox**
   - ✅ Still uses same API_BASE
   - ✅ Evaluate, Form Copilot, Explain all work

2. **Facility CSF Sandbox**
   - ✅ Still uses same API_BASE
   - ✅ All features functional

3. **Other License Sandboxes**
   - ✅ Ohio TDDD License
   - ✅ NY Pharmacy License
   - ✅ All still functional

## Common Issues

### Backend Import Errors
If you see `ModuleNotFoundError: No module named 'autocomply'`:
- ✅ Fixed in this PR - all imports now use `src.autocomply`

### 422 Validation Errors
If you see "field required" or "validation error":
- ✅ Fixed in this PR - schemas now match between frontend and backend

### White Text on Inputs
If inputs appear blank or text is invisible:
- ✅ Fixed in this PR - explicit colors set in index.css

### 404 on Form Copilot
If `/csf/hospital/form-copilot` returns 404:
- Check backend is running on port 8000
- Check `csf_hospital_router` is included in `main.py`
- ✅ Import paths fixed in this PR

## Files Modified Summary

### Frontend (5 files)
1. `frontend/src/components/HospitalCsfSandbox.tsx` - Fixed schema mismatches, disabled Codex button
2. `frontend/src/api/csfExplainClient.ts` - Updated interface types
3. `frontend/src/index.css` - Fixed input text colors

### Backend (4 files)
1. `backend/src/api/routes/csf_explain.py` - Fixed import path
2. `backend/src/api/routes/rag_regulatory.py` - Fixed import path
3. `backend/src/autocomply/domain/csf_explain.py` - Fixed import path
4. `backend/src/autocomply/domain/rag_regulatory_explain.py` - Fixed import path

### Documentation (1 file)
1. `HOSPITAL_CSF_VERIFICATION.md` - This file

## Success Criteria

All of the following must be true:

- ✅ Hospital Form Copilot returns 200 (not 404)
- ✅ Explain decision returns 200 (not 422)
- ✅ Deep RAG explain returns 200 (not 422)
- ✅ Input text is readable (dark on light background)
- ✅ "Ask Codex" button is disabled with clear messaging
- ✅ All API calls go to 127.0.0.1:8000 (not 5173)
- ✅ No regressions in other CSF sandboxes
- ✅ Console shows correct API_BASE on load

## Next Steps (Future Enhancements)

1. Implement real "Ask Codex" functionality using existing explain endpoints
2. Add more Hospital CSF presets for edge cases
3. Improve error messages to show full backend validation errors
4. Add loading states for all async operations
5. Consider caching regulatory artifacts to reduce API calls
