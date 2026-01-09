# Step 1.8 Testing Guide - Explainability Quality

## 🧪 Quick Test Scenarios

### Prerequisites
1. Backend running on port 8001
2. Frontend running on port 5173
3. Navigate to RAG Explorer: `http://localhost:5173/console/rag`

---

## Test 1: Blocked Scenario with Low Completeness

**Objective**: Verify completeness score shows missing fields and counterfactuals explain non-fired rules

### Steps
1. Open RAG Explorer in **Sandbox** mode
2. Select scenario: **"Practitioner CSF – Blocked (missing DEA)"**
3. Click **"Explain Decision"**
4. Wait for results to load

### Expected Results

✅ **Outcome Badge**: ❌ BLOCKED (red)

✅ **Fired Rules Section**: Shows rules that triggered (e.g., "DEA Number Required")

✅ **📊 Data Completeness Section**:
- Score: **< 100%** (likely 45-75%)
- Color: Yellow or Red
- Shows count: "X of Y required fields present"
- **🚫 Missing BLOCK Fields**: Lists critical missing fields
  - DEA Number
  - DEA Expiration Date
  - etc.
- **⚠️ Missing REVIEW Fields**: Lists recommended missing fields (if any)

✅ **🔍 Why Other Rules Did Not Fire**:
- Shows 2-5 counterfactuals
- Each shows:
  - Rule title + severity badge
  - "Why not:" explanation (missing evidence)
  - "To satisfy:" guidance
  - Jurisdiction + citation
- Example: 
  ```
  Ryan Haight Act - Telemedicine Exception [BLOCK]
  Why not: Not triggered because required data is missing: Telemedicine Flag, Telemedicine DEA Certification
  To satisfy: Provide complete Telemedicine Flag, Telemedicine DEA Certification
  ```

✅ **✉️ Request Missing Information**:
- Section appears (not hidden)
- Shows count: "X fields missing"
- Textarea contains professional message template
- Message includes:
  - Submission ID
  - List of missing BLOCK fields with [REQUIRED] tag
  - List of missing REVIEW fields with [RECOMMENDED] tag
  - Urgency note: "⚠️ IMPORTANT: X required fields are missing..."
- **📋 Copy to Clipboard** button works
- **🔄 Reset Template** button works

---

## Test 2: Approved Scenario with High Completeness

**Objective**: Verify completeness score shows 100% and counterfactuals explain conditions not met

### Steps
1. Open RAG Explorer in **Sandbox** mode
2. Select scenario: **"Practitioner CSF – Approved (complete data)"** (or any approved scenario)
3. Click **"Explain Decision"**

### Expected Results

✅ **Outcome Badge**: ✅ APPROVED (green)

✅ **Fired Rules Section**: May be empty or show INFO rules

✅ **📊 Data Completeness Section**:
- Score: **100%** or **90%+**
- Color: Green
- Shows: "All required data fields are present" (if 100%)
- OR shows minimal missing INFO fields (if <100%)

✅ **🔍 Why Other Rules Did Not Fire**:
- Shows counterfactuals (even for approved)
- Explanations focus on **"condition not met"** rather than "missing data"
- Examples:
  ```
  Ohio TDDD Certificate Required [BLOCK]
  Why not: Not triggered - condition not met: only applies to Ohio jurisdictions
  To satisfy: This rule only applies to Ohio jurisdictions
  ```
  ```
  Ryan Haight Act - Telemedicine Exception [BLOCK]
  Why not: Not triggered - condition not met: only applies to telemedicine prescriptions
  To satisfy: This rule only applies to telemedicine prescriptions
  ```

✅ **✉️ Request Missing Information**:
- Section **hidden** (no missing fields) OR
- Shows message: "This submission appears to be complete. No additional information is required."

---

## Test 3: Connected Mode with Real Submission

**Objective**: Verify all features work with stored submission data

### Steps
1. Open RAG Explorer in **Connected** mode (click "Connected" filter chip)
2. Select a submission from the dropdown (e.g., "Hospital CSF – Ohio – Blocked")
3. Click **"Explain Decision"**

### Expected Results

✅ All sections appear as in Test 1 or Test 2 (depending on submission status)

✅ **Completeness score** calculated from actual submission payload

✅ **Counterfactuals** generated based on CSF type (Practitioner vs Hospital)
- If Hospital submission: Shows hospital-specific rules
- If Practitioner submission: Shows practitioner-specific rules

✅ **Request info message** includes actual submission ID

✅ **Copy to Clipboard** works
- Click button
- Paste in notepad/email client
- Verify full message copied

---

## Test 4: Edge Cases

### 4a. Empty Payload
1. (If possible) Select a submission with minimal/empty payload
2. Verify **no runtime errors**
3. Verify completeness shows 0% or very low score
4. Verify counterfactuals explain missing evidence

### 4b. Copy to Clipboard
1. Click **📋 Copy to Clipboard** button
2. Open notepad or email client
3. Press Ctrl+V (paste)
4. Verify full message template pasted correctly

### 4c. Reset Template
1. After copying, click **🔄 Reset Template**
2. Verify textarea reloads with fresh template
3. Verify content matches original

### 4d. Switch Between Sandbox and Connected
1. Start in Sandbox mode
2. Explain a scenario
3. Switch to Connected mode
4. Explain a submission
5. Verify all sections update correctly
6. No stale data from previous mode

---

## Test 5: Visual Verification

### Completeness Score Colors
- **100%**: Green text (#10b981)
- **75-99%**: Yellow text (#f59e0b)
- **<75%**: Red text (#ef4444)

### Severity Badges
- **BLOCK**: Red background/border
- **REVIEW**: Yellow background/border
- **INFO**: Blue background/border

### Layout
- All 3 new sections have consistent styling
- Dark backgrounds (zinc-900/70)
- Proper spacing between sections
- Readable text sizes (11px-14px)
- Monospace font in request info textarea

---

## Common Issues & Troubleshooting

### Issue: Sections don't appear
- **Cause**: Explain hasn't run yet
- **Fix**: Click "Explain Decision" first

### Issue: Completeness shows 0%
- **Cause**: Empty payload or unrecognized CSF type
- **Fix**: Verify payload has data; check CSF type is "csf_practitioner" or "csf_hospital"

### Issue: No counterfactuals shown
- **Cause**: All rules fired (rare) or CSF type mismatch
- **Fix**: Try different scenario with fewer fired rules

### Issue: Copy to clipboard doesn't work
- **Cause**: Browser permissions
- **Fix**: Allow clipboard access in browser settings

### Issue: Request info section hidden
- **Cause**: No missing fields (completeness 100%)
- **Fix**: This is correct behavior; try blocked scenario instead

---

## Success Criteria Checklist

- [ ] Blocked scenario shows completeness < 100%
- [ ] Missing BLOCK fields listed
- [ ] Missing REVIEW fields listed
- [ ] At least 2 counterfactuals display
- [ ] Counterfactual explanations make sense
- [ ] Request info message generated
- [ ] Message includes submission ID
- [ ] Message lists missing fields with severity tags
- [ ] Urgency note appears for BLOCK fields
- [ ] Copy to clipboard works
- [ ] Reset template works
- [ ] Approved scenario shows high completeness
- [ ] Approved scenario counterfactuals explain "not applicable"
- [ ] Works in Sandbox mode
- [ ] Works in Connected mode
- [ ] No JavaScript errors in console
- [ ] UI looks clean and professional

---

## 📸 Screenshot Checklist

Capture screenshots of:
1. Blocked scenario with all 3 new sections visible
2. Completeness score showing < 100% with missing fields
3. Counterfactuals section with 3-5 rules
4. Request info message template in textarea
5. Approved scenario with 100% completeness
6. Counterfactuals in approved scenario (condition not met)

---

**Ready for QA testing!**
