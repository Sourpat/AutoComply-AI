# Quick Test Commands - Phase 1.2 Decision Explain Panel

## Start Services

### Terminal 1: Backend
```powershell
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend
.\.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### Terminal 2: Frontend
```powershell
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\frontend
npm run dev
```

---

## Manual Test Checklist

### 1. Navigate to RAG Explorer
- URL: http://localhost:5173/console
- Click: **"RAG Explorer"** in left sidebar
- Scroll to: **"Decision Explainability"** panel (middle panel)

### 2. Test BLOCKED Scenario
- Select: **"BLOCKED - Missing DEA Registration"**
- Click: **"Explain Decision"**
- ✅ Verify:
  - ❌ BLOCKED badge (red)
  - Missing Evidence: "Valid DEA registration certificate"
  - Next Steps: "Obtain or renew DEA registration before reapplying"
  - Fired Rules: 🚫 BLOCK section with 2-3 rules
  - Each rule has: title, citation (e.g., "21 CFR 1301.13"), requirement text

### 3. Test NEEDS_REVIEW Scenario
- Select: **"NEEDS REVIEW - DEA Expiring Soon + Telemedicine..."**
- Click: **"Explain Decision"**
- ✅ Verify:
  - ⚠️ NEEDS REVIEW badge (yellow)
  - Missing Evidence: "DEA expiring in 20 days", "Ryan Haight Act attestation"
  - Next Steps: "Renew DEA registration", "Complete attestation form"
  - Fired Rules: ⚠️ REVIEW section with 2+ rules
  - Citations: "Internal Policy", "21 USC 829(e)"

### 4. Test APPROVED Scenario
- Select: **"APPROVED - All Requirements Met"**
- Click: **"Explain Decision"**
- ✅ Verify:
  - ✅ APPROVED badge (green)
  - Next Steps: "Proceed with controlled substance checkout"
  - Fired Rules: May have ℹ️ INFO section (informational)
  - No missing evidence (or minimal)

### 5. Verify No Errors
- Open DevTools: **F12** → **Console** tab
- Should see: No red errors
- Network tab: All `/rag/regulatory-explain` requests return **200 OK**

### 6. Verify Loading State
- Click "Explain Decision" and watch for:
  - Spinner appears briefly
  - Text changes to "Explaining..."
  - Results appear within 1-2 seconds

---

## Quick Backend Tests (Optional)

### Test Evaluator Directly
```powershell
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend

# Quick smoke test
.\.venv\Scripts\python -c "import sys; sys.path.insert(0, 'src'); from src.autocomply.domain.csf_practitioner_evaluator import get_mock_scenarios; print('Scenarios:', len(get_mock_scenarios()))"
```

**Expected**: `Scenarios: 3`

### Test Explain Endpoint via HTTP
```powershell
# Test BLOCKED scenario
$payload = @{
  question = "Why was this blocked?"
  decision_type = "csf_practitioner"
  engine_family = "csf"
  decision = @{
    evidence = @{
      dea_registration = $false
      state_license_status = "Active"
      dea_expiry_days = 0
      state_license_expiry_days = 180
      authorized_schedules = @()
      requested_schedules = @("II", "III", "IV", "V")
      has_prior_violations = $false
      telemedicine_practice = $false
      has_ryan_haight_attestation = $false
      multi_state = $false
      documented_jurisdictions = @("OH")
      has_npi = $true
    }
  }
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod -Uri "http://127.0.0.1:8001/rag/regulatory-explain" -Method Post -ContentType "application/json" -Body $payload

# Check outcome
Write-Host "Outcome: $($result.debug.outcome)"
Write-Host "Fired rules: $($result.debug.fired_rules_count)"
Write-Host "Missing evidence: $($result.debug.missing_evidence -join ', ')"
```

**Expected Output**:
```
Outcome: blocked
Fired rules: 3
Missing evidence: Valid DEA registration certificate, DEA authorization for schedules: II, III, IV, V
```

---

## Success Criteria

- [x] All 3 scenarios return distinct outcomes
- [x] Fired rules display with citations
- [x] Missing evidence clearly listed
- [x] Next steps provide guidance
- [x] No console errors
- [x] No blank screens
- [x] Loading states work
- [x] Outcome badges color-coded correctly

---

## If Something Breaks

### Backend Error
1. Check backend terminal for stack trace
2. Verify imports: `python -c "from src.api.routes.rag_regulatory import router; print('OK')"`
3. Restart backend: Ctrl+C, then restart uvicorn

### Frontend Error
1. Check browser console (F12)
2. Check network tab for failed API calls
3. Verify backend health: http://127.0.0.1:8001/health
4. Restart frontend: Ctrl+C in terminal, then `npm run dev`

### Module Not Found
- Ensure PYTHONPATH is set: `$env:PYTHONPATH="C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh\backend\src"`
- Restart backend with PYTHONPATH

### Blank Results
- Check that scenario dropdown has selection
- Verify evidence payload is being sent (check network tab)
- Test evaluator directly with mock scenario

---

**Ready to demo!** 🚀
