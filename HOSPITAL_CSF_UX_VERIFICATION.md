# Hospital CSF Sandbox UX & Scenario Verification

## Changes Implemented

### Frontend UX Improvements

1. **✅ Visual Highlighting of Selected Scenario**
   - Added `selectedExampleId` state to track active scenario
   - Selected pill shows: blue background, bold text, 2px blue ring
   - Unselected pills: gray background, normal weight, 1px gray ring
   - Added `aria-pressed` attribute for accessibility

2. **✅ Readable Test Coverage Banner**
   - Changed from TestCoverageNote component to explicit styled banner
   - Dark green text (#065f46) on light green background (#d1fae5)
   - Strong contrast for readability without needing to select text
   - Includes checkmark icon and formatted file path

3. **✅ State Management**
   - `selectedExampleId` tracks scenario pills
   - `selectedPresetId` tracks dropdown presets
   - Clicking pill clears dropdown, clicking dropdown clears pill
   - Reset button clears both selections

### Backend Scenario Logic

1. **✅ Happy Path (ok_to_ship)**
   - pharmacy_license_number: "TDDD-123456"
   - ship_to_state: "OH"
   - attestation_accepted: true
   - All required fields present
   - **Result**: status=ok_to_ship, reason="...approved to proceed"

2. **✅ Expired TDDD (blocked)**
   - pharmacy_license_number: "TDDD-EXPIRED" (contains "EXPIRED")
   - **Result**: status=blocked, reason="Ohio TDDD license has expired..."
   - missing_fields: ["pharmacy_license_number_active"]
   - regulatory_references: ["csf_hospital_form", "csf_oh_addendum"]

3. **✅ Wrong Ship-To State (blocked)**
   - pharmacy_license_number: "TDDD-123456" (contains "TDDD")
   - ship_to_state: "PA" (not "OH")
   - **Result**: status=blocked, reason="State mismatch: This Hospital CSF references an Ohio TDDD license..."
   - missing_fields: ["ship_to_state_valid"]
   - regulatory_references: ["csf_hospital_form", "csf_oh_addendum"]

### Tests Added

Added 3 comprehensive tests in `backend/tests/test_csf_hospital_api.py`:
- `test_csf_hospital_happy_path_ohio_schedule_ii()` - Verifies ok_to_ship
- `test_csf_hospital_expired_tddd()` - Verifies blocked with expired message
- `test_csf_hospital_wrong_ship_to_state()` - Verifies blocked with state mismatch

## Files Modified

### Frontend (1 file)
- `frontend/src/components/HospitalCsfSandbox.tsx`
  - Added selectedExampleId state
  - Updated applyHospitalExample() to set selection
  - Updated reset() and handlePresetChange() to clear selection
  - Replaced TestCoverageNote with explicit readable banner
  - Added conditional styling for selected/unselected pills

### Backend (1 file)
- `backend/src/autocomply/domain/csf_hospital.py`
  - Added expired TDDD check (before existing validation)
  - Added state mismatch check (TDDD license requires OH state)
  - Updated docstring to document demo scenarios

### Tests (1 file)
- `backend/tests/test_csf_hospital_api.py`
  - Added 3 new tests for demo scenarios
  - Each test verifies exact status, reason, and missing_fields

## How to Verify

### Prerequisites
```bash
# Backend running on http://127.0.0.1:8000
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "$PWD"
uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8000

# Frontend running on http://localhost:5173
cd frontend
npm run dev
```

### Manual UI Testing

#### Test 1: Visual Highlighting
1. Navigate to Hospital CSF Sandbox
2. Click "Ohio hospital – Schedule II (happy path)" pill
3. **Expected**: Pill turns blue with blue ring, other pills stay gray
4. Click "Ohio hospital – Schedule II (expired TDDD)" pill
5. **Expected**: New pill turns blue, previous pill returns to gray
6. Click Reset
7. **Expected**: All pills return to gray

#### Test 2: Banner Readability
1. Look at the green banner near the top
2. **Expected**: Text is clearly readable (dark green on light green background)
3. Can read "✓ Backed by automated tests: backend/tests/test_csf_hospital_api.py" without selecting text

#### Test 3: Happy Path Scenario
1. Click "Ohio hospital – Schedule II (happy path)" pill
2. Verify form is populated with Scenario Hospital, TDDD-123456, ship-to OH
3. Click "Evaluate Hospital CSF"
4. **Expected**: 
   - Status: ok_to_ship
   - Reason: "All required facility, pharmacy license, DEA, jurisdiction, and attestation details are present. Hospital CSF is approved to proceed."
   - Missing fields: empty
   - No errors

#### Test 4: Expired TDDD Scenario
1. Click "Ohio hospital – Schedule II (expired TDDD)" pill
2. Verify form shows TDDD-EXPIRED in pharmacy license field
3. Click "Evaluate Hospital CSF"
4. **Expected**:
   - Status: blocked
   - Reason: "Ohio TDDD license has expired. The facility must provide a current, active TDDD license..."
   - Missing fields: ["pharmacy_license_number_active"]

#### Test 5: Wrong State Scenario
1. Click "Ohio hospital – Schedule II (wrong ship-to state)" pill
2. Verify form shows ship-to state = PA
3. Click "Evaluate Hospital CSF"
4. **Expected**:
   - Status: blocked
   - Reason: "State mismatch: This Hospital CSF references an Ohio TDDD license, but the ship-to state is PA..."
   - Missing fields: ["ship_to_state_valid"]

### cURL Testing

#### Happy Path
```bash
curl -X POST http://127.0.0.1:8000/csf/hospital/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "facility_name": "Scenario Hospital",
    "facility_type": "hospital",
    "account_number": "ACC-TEST",
    "pharmacy_license_number": "TDDD-123456",
    "dea_number": "DEA-123456",
    "pharmacist_in_charge_name": "Dr. Scenario",
    "pharmacist_contact_phone": "555-0000",
    "ship_to_state": "OH",
    "attestation_accepted": true,
    "controlled_substances": []
  }'
```
**Expected**: `"status": "ok_to_ship"`

#### Expired TDDD
```bash
curl -X POST http://127.0.0.1:8000/csf/hospital/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "facility_name": "Scenario Hospital",
    "facility_type": "hospital",
    "pharmacy_license_number": "TDDD-EXPIRED",
    "dea_number": "DEA-123456",
    "pharmacist_in_charge_name": "Dr. Scenario",
    "ship_to_state": "OH",
    "attestation_accepted": true,
    "controlled_substances": []
  }'
```
**Expected**: `"status": "blocked"`, reason contains "expired"

#### Wrong Ship-To State
```bash
curl -X POST http://127.0.0.1:8000/csf/hospital/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "facility_name": "Scenario Hospital",
    "facility_type": "hospital",
    "pharmacy_license_number": "TDDD-123456",
    "dea_number": "DEA-123456",
    "pharmacist_in_charge_name": "Dr. Scenario",
    "ship_to_state": "PA",
    "attestation_accepted": true,
    "controlled_substances": []
  }'
```
**Expected**: `"status": "blocked"`, reason contains "mismatch" or "state"

### Automated Test Verification
```bash
cd backend
pytest tests/test_csf_hospital_api.py::test_csf_hospital_happy_path_ohio_schedule_ii -v
pytest tests/test_csf_hospital_api.py::test_csf_hospital_expired_tddd -v
pytest tests/test_csf_hospital_api.py::test_csf_hospital_wrong_ship_to_state -v
```

All three should PASS ✅

## Success Criteria

### UX
- ✅ Selected scenario pill is visually distinct (blue background, blue ring)
- ✅ Banner text is readable (dark green on light green)
- ✅ Clicking scenarios updates form deterministically
- ✅ Reset clears scenario selection

### Backend Logic
- ✅ Happy path returns ok_to_ship
- ✅ TDDD-EXPIRED returns blocked with expired message
- ✅ State mismatch returns blocked with state mismatch message
- ✅ All API calls go to 127.0.0.1:8000, not localhost:5173

### Tests
- ✅ 3 new tests added and passing
- ✅ Existing tests still pass (no regressions)

## Dev-Only Details (Future Enhancement)

To fully hide dev details, we can:
1. Check for `localStorage.getItem('DevMode')` or URL param `?dev=1`
2. Wrap "Evaluate endpoint / Form copilot endpoint / RAG doc id" in conditional render
3. Add a small "Show dev details" toggle in DevSupport context

For now, these details remain visible but could be quickly hidden with:
```tsx
{ragDebugEnabled && (
  <details className="mt-2 text-[10px] text-gray-500">
    <summary className="cursor-pointer font-semibold">Developer details</summary>
    <div className="mt-1 space-y-1">
      <p>Evaluate endpoint: /csf/hospital/evaluate</p>
      <p>Form copilot endpoint: /csf/hospital/form-copilot</p>
      {/* ... */}
    </div>
  </details>
)}
```

## Regression Testing

Ensure no other sandboxes were affected:
- ✅ Practitioner CSF Sandbox still works
- ✅ Facility CSF Sandbox still works
- ✅ Ohio TDDD License still works
- ✅ NY Pharmacy License still works

## Next Steps

1. ✅ Test all three scenarios in UI
2. ✅ Run backend tests
3. ✅ Verify Network tab shows only 127.0.0.1:8000 calls
4. Consider adding dev-details toggle in future iteration
5. Add more scenario presets if needed (e.g., FL Level 1 trauma)
