# Practitioner CSF Sandbox – UX Verification Checklist

This document provides comprehensive verification steps for the Practitioner CSF Sandbox improvements.

## ✅ Prerequisites

1. **Backend running**: `cd backend && .venv\Scripts\Activate.ps1 && uvicorn src.api.main:app --host 127.0.0.1 --port 8000`
2. **Frontend running**: `cd frontend && npm run dev`
3. **Environment configured**: `VITE_API_BASE=http://127.0.0.1:8000` in `frontend/.env.local`

## 🎨 Visual Improvements

### Test Banner
- [ ] Banner displays with light green background (`bg-emerald-50`)
- [ ] Dark green text (`text-emerald-800`) is clearly readable
- [ ] Check icon (✓) appears next to "Backed by automated tests"
- [ ] Test file path shown in monospace font: `backend/tests/test_csf_practitioner_api.py`
- [ ] Banner has subtle border (`border-emerald-200`)

### Scenario Pills
- [ ] Three scenario pills displayed: "Primary care (happy path)", "Pain clinic (needs review)", "Telehealth-only prescriber (blocked)"
- [ ] Selected pill has:
  - Blue ring border (`ring-2 ring-blue-200`)
  - Blue background (`bg-blue-50`)
  - Dark blue text (`text-blue-900`)
- [ ] Unselected pills have:
  - Gray border (`border-gray-300`)
  - White background
  - Gray text (`text-gray-700`)
- [ ] Hover effect on unselected pills (lighter border and background)
- [ ] Scenario description appears below pills in blue info box when selected

### Controlled Substances Search
- [ ] Search input placeholder shows: "Try: Hydrocodone, NDC 00093-3102-01, DEA Schedule II"
- [ ] Placeholder text is helpful and actionable
- [ ] Text is readable (dark on white)

## 🔄 Scenario Logic & Backend Behavior

### Scenario 1: Primary Care (Happy Path)
**Expected outcome: `ok_to_ship`**

1. [ ] Click "Primary care prescriber (happy path)" pill
2. [ ] Verify form pre-fills with:
   - Facility: "Hudson Valley Primary Care"
   - Practitioner: "Dr. Alicia Patel"
   - State: NY
   - Attestation: ✓ checked
3. [ ] Click "Evaluate Practitioner CSF"
4. [ ] Decision shows: **ok_to_ship**
5. [ ] Reason includes: "approved to proceed" or similar positive language
6. [ ] No missing fields shown

### Scenario 2: Pain Clinic (Needs Review)
**Expected outcome: `needs_review`**

1. [ ] Click "Pain clinic (needs review)" pill
2. [ ] Verify form pre-fills with:
   - Facility: "Central Ohio Pain Clinic"
   - Account: "ACCT-44110"
   - Controlled substance: Oxycodone 10mg (Schedule II)
3. [ ] Click "Evaluate Practitioner CSF"
4. [ ] Decision shows: **needs_review** (NOT ok_to_ship or blocked)
5. [ ] Reason mentions: "pain" or "Schedule II" or "review required"
6. [ ] Regulatory references include practitioner form

### Scenario 3: Telehealth-Only (Blocked)
**Expected outcome: `blocked`**

1. [ ] Click "Telehealth-only prescriber (blocked)" pill
2. [ ] Verify form pre-fills with:
   - Facility: "Bridgeway Telehealth"
   - State license: empty
   - Attestation: ✗ unchecked
3. [ ] Click "Evaluate Practitioner CSF"
4. [ ] Decision shows: **blocked**
5. [ ] Reason mentions: "missing" or "attestation" or "required fields"
6. [ ] Missing fields list includes: `state_license_number` and/or `attestation_accepted`

## 🧪 Backend Tests

Run all tests to verify backend logic:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH="$PWD"
pytest tests/test_csf_practitioner_api.py -v
```

**Expected results:**
- [ ] ✅ `test_csf_practitioner_evaluate_ok_to_ship` PASSED
- [ ] ✅ `test_csf_practitioner_evaluate_blocked_when_missing_fields` PASSED
- [ ] ✅ `test_csf_practitioner_evaluate_blocked_when_attestation_not_accepted` PASSED
- [ ] ✅ `test_csf_practitioner_primary_care_happy_path` PASSED (ok_to_ship)
- [ ] ✅ `test_csf_practitioner_pain_clinic_needs_review` PASSED (needs_review)
- [ ] ✅ `test_csf_practitioner_telehealth_blocked` PASSED (blocked)

All 6 tests should pass with no errors.

## 📋 Submission Flow

### Submit for Verification
1. [ ] Fill out any valid practitioner form
2. [ ] Click **"Submit for verification"** button (green button)
3. [ ] Button shows "Submitting…" spinner state
4. [ ] Success message appears in green box with check icon
5. [ ] Submission ID displayed in monospace font
6. [ ] Message shows: "This CSF has been queued for internal verification review."

### Error Handling
1. [ ] Stop backend server
2. [ ] Try to submit form
3. [ ] Error message appears in red box
4. [ ] Error is clear and actionable

### Submission Retrieval (API)
```bash
# Get submission by ID (replace with actual ID from UI)
curl http://127.0.0.1:8000/csf/practitioner/submissions/{submission_id}
```

- [ ] Returns full submission data including form, decision, and metadata
- [ ] Shows `status: "submitted"`
- [ ] Includes `created_at` timestamp

## 🔄 Copilot Staleness Detection

### Form Change Detection
1. [ ] Click "Check & Explain" to run Form Copilot
2. [ ] Copilot results appear
3. [ ] Change any form field (e.g., practitioner name)
4. [ ] **Amber warning banner** appears: "⚠️ Form has changed since last copilot analysis..."
5. [ ] Click "Check & Explain" again
6. [ ] Warning banner disappears
7. [ ] Fresh results appear

### Scenario Change Detection
1. [ ] Select "Primary care" scenario
2. [ ] Run Form Copilot
3. [ ] Select "Pain clinic" scenario
4. [ ] Copilot results **immediately clear**
5. [ ] No stale data shown

### Controlled Substances Change Detection
1. [ ] Run Form Copilot
2. [ ] Go to Controlled Substances panel
3. [ ] Search for and add a new item (or remove existing item)
4. [ ] Copilot results **immediately clear** or warning appears
5. [ ] No stale data shown

## 🎛️ Form Copilot Behavior

### Basic Flow
1. [ ] Fill out form completely
2. [ ] Click "Check & Explain"
3. [ ] Button shows "Checking…" loading state
4. [ ] Regulatory Insights Panel appears with:
   - Decision status badge
   - Reason text
   - Missing fields (if any)
   - RAG explanation
   - Regulatory sources (if RAG enabled)

### Error Handling
1. [ ] Leave required fields empty
2. [ ] Run copilot
3. [ ] Error message shows clearly
4. [ ] User can fix form and retry

## 🔍 Integration Points

### cURL Copy Functionality
1. [ ] Click "Copy Practitioner CSF cURL" button
2. [ ] Paste into terminal
3. [ ] Execute command
4. [ ] Verify response matches UI behavior

### Ohio TDDD Check (if applicable)
1. [ ] Set ship-to state to "OH"
2. [ ] Fill in pharmacy license number
3. [ ] Click "Check Ohio TDDD"
4. [ ] Appropriate response appears (or error if not applicable)

## 📊 Quality Metrics

### Performance
- [ ] Form loads instantly (<100ms)
- [ ] Scenario switching is immediate
- [ ] API calls complete within 2 seconds
- [ ] No console errors in browser dev tools

### Accessibility
- [ ] All buttons have clear labels
- [ ] Focus rings visible when tabbing
- [ ] Color contrast meets WCAG standards (green/red/blue text on appropriate backgrounds)
- [ ] Placeholder text is helpful, not just "Enter text"

### Consistency with Hospital Sandbox
- [ ] Test banner style matches Hospital sandbox
- [ ] Scenario pill highlighting matches Hospital sandbox (blue ring + background)
- [ ] Staleness warning banner matches Hospital sandbox (amber)
- [ ] Button styles and spacing consistent

## 🚀 Next Steps

After verification, these patterns can be applied to:
- [ ] **Facility CSF Sandbox** (same staleness tracking, test banner, scenario logic)
- [ ] **EMS CSF Sandbox** (if it exists)
- [ ] Other compliance sandboxes

## 📝 Notes

- **TODO**: Replace in-memory submission store with database
- **TODO**: Integrate with internal verification console
- **TODO**: Add submission status updates (approved/rejected)
- **TODO**: Add notification system for verification specialists

---

## ✨ Success Criteria

All checks above should pass with no manual code changes needed. The Practitioner CSF Sandbox should:

1. ✅ Match Hospital sandbox UX quality
2. ✅ Have readable, high-contrast UI elements
3. ✅ Show distinct outcomes for all three scenarios
4. ✅ Never display stale copilot results
5. ✅ Support full submission workflow
6. ✅ Pass all backend tests
7. ✅ Be production-ready (pending DB integration)

**Status**: Ready for user acceptance testing ✅
