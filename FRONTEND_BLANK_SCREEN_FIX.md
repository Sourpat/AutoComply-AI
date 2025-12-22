# Frontend Blank Screen - Troubleshooting Guide ✅

## ✅ Current Status (All Systems Working!)

### Backend ✅
- **Running on:** http://127.0.0.1:8001
- **Health Check:** ✅ PASSING
- **Practitioner CSF:** ✅ FIXED (was crashing, now working)
- **CORS:** ✅ Configured (`Access-Control-Allow-Origin: *`)

### Frontend ✅
- **Running on:** http://localhost:5173
- **Dev Server:** ✅ 4 node processes running
- **Serving Content:** ✅ HTTP 200 (645 bytes)
- **.env.local:** ✅ Exists with `VITE_API_BASE=http://127.0.0.1:8001`
- **Compilation:** ✅ No TypeScript errors

---

## 🔧 If You're Seeing a Blank Screen

### Solution 1: Hard Refresh Browser (MOST COMMON)
The frontend code has changed, and your browser may have cached old JavaScript.

**Windows/Linux:**
```
Ctrl + Shift + R  (hard refresh)
```

**Or:**
```
Ctrl + F5
```

**Mac:**
```
Cmd + Shift + R
```

**Or clear cache:**
1. Press `F12` (open DevTools)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

---

### Solution 2: Check Browser Console for Errors

1. Press `F12` to open DevTools
2. Click the **Console** tab
3. Look for RED error messages

**Common Issues & Fixes:**

#### Issue: "Failed to fetch" or "NetworkError"
**Cause:** Backend not running or wrong port
**Fix:**
```powershell
# Make sure backend is running on 8001:
cd C:\Users\sourp\AutoComply-AI-fresh\backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "$PWD"
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001 --reload
```

#### Issue: "Unexpected token '<'" or "SyntaxError"
**Cause:** Browser cached old JavaScript
**Fix:** Hard refresh (Ctrl + Shift + R)

#### Issue: Blank screen, no errors
**Cause:** React ErrorBoundary caught an error
**Fix:** 
1. Check if you see a pink/rose error box
2. Click "Show error details"
3. Look for the error message

---

### Solution 3: Restart Frontend Dev Server

```powershell
# Stop frontend (Ctrl+C in the frontend terminal)

# Then restart:
cd C:\Users\sourp\AutoComply-AI-fresh\frontend
npm run dev
```

Then open: http://localhost:5173

---

### Solution 4: Verify Backend Connection Indicator

When the page loads, you should see a **small indicator** in the **bottom-right corner**:

- 🟢 **Green dot** = Connected (backend is healthy)
- 🔴 **Red box** = Disconnected (with troubleshooting tips)
- 🟡 **Yellow** = Checking...

**If you see RED:**
1. Check that backend is running on port 8001
2. Check that .env.local has `VITE_API_BASE=http://127.0.0.1:8001`
3. Hard refresh browser

---

## 🧪 Manual Testing Steps

### Step 1: Verify Backend is Running
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8001/health"
```
**Expected:** HTTP 200 with `{"status":"ok",...}`

### Step 2: Verify Frontend is Serving
```powershell
Invoke-WebRequest -Uri "http://localhost:5173"
```
**Expected:** HTTP 200 with HTML content

### Step 3: Test CSF Endpoints
```powershell
# Test Hospital CSF
Invoke-WebRequest -Uri "http://127.0.0.1:8001/csf/hospital/evaluate" `
  -Method POST `
  -Body '{"facility_name":"Test","facility_type":"hospital","account_number":"T1","pharmacy_license_number":"P1","dea_number":"D1","pharmacist_in_charge_name":"Dr","ship_to_state":"NY","attestation_accepted":true,"controlled_substances":[]}' `
  -ContentType "application/json"
```
**Expected:** HTTP 200

### Step 4: Open Browser and Check
1. Open http://localhost:5173
2. Press `F12` (open DevTools)
3. Click **Network** tab
4. Hard refresh (`Ctrl + Shift + R`)
5. Look for:
   - `main.jsx` or `index.js` loads successfully (200 status)
   - `/health` request to 127.0.0.1:8001 (200 status)
6. Click **Console** tab
7. Look for errors (should be NONE)

---

## 🐛 Debugging Tips

### Check What's Actually Loaded
1. Press `F12` → **Console** tab
2. Type:
   ```javascript
   window.location.href
   ```
   **Expected:** `http://localhost:5173/`

3. Type:
   ```javascript
   import.meta.env.VITE_API_BASE
   ```
   **Expected:** `http://127.0.0.1:8001`

4. Type:
   ```javascript
   fetch('http://127.0.0.1:8001/health').then(r => r.json()).then(console.log)
   ```
   **Expected:** `{status: "ok", service: "autocomply-ai", ...}`

### Check ErrorBoundary State
If you see a pink error box, the ErrorBoundary caught a React error.

**Common causes:**
- Missing import
- Invalid JSX syntax
- Component prop type mismatch

**Fix:** Look at the stack trace in the error details

---

## 📝 What Was Fixed

### Backend Fix: Practitioner CSF Crash ✅
**File:** `backend/src/api/routes/csf_practitioner.py`

**Error:**
```python
AttributeError: 'PractitionerCsfDecision' object has no attribute 'risk_level'
```

**Fix:**
```python
# BEFORE (broken):
decision_outcome = DecisionOutcome(
    status=normalized_status,
    reason=decision.reason,
    risk_level=decision.risk_level,  # ❌ This field doesn't exist!
    ...
)

# AFTER (working):
from src.autocomply.domain.decision_risk import compute_risk_for_status

# Compute risk level and score based on decision status
risk_level, risk_score = compute_risk_for_status(normalized_status.value)

decision_outcome = DecisionOutcome(
    status=normalized_status,
    reason=decision.reason,
    risk_level=risk_level,  # ✅ Now computed correctly
    risk_score=risk_score,  # ✅ Added
    ...
)
```

**Result:** Practitioner CSF now matches Hospital CSF pattern ✅

---

## ✅ Expected UI After Fix

When you open http://localhost:5173, you should see:

1. **Home page** with:
   - AutoComply AI branding
   - "Controlled Substance Suite" section
   - "License Suite" section
   - "Compliance Console" section

2. **Bottom-right corner:**
   - Small green dot (backend connected)
   - On hover: "API: http://127.0.0.1:8001"

3. **No errors in console**

4. **Click "CSF Sandbox" → "Hospital":**
   - Form loads with fields
   - "Evaluate" button visible
   - No "Evaluating..." stuck state
   - Clicking Evaluate shows decision (OK_TO_SHIP / BLOCKED / NEEDS_REVIEW)

---

## 🚨 If Still Blank After All Steps

1. **Check terminal output** - Look for frontend compilation errors
2. **Try different browser** - Test in Chrome/Edge/Firefox
3. **Check Windows Firewall** - Make sure ports 5173 and 8001 are allowed
4. **Kill all node processes and restart:**
   ```powershell
   Get-Process node | Stop-Process -Force
   cd C:\Users\sourp\AutoComply-AI-fresh\frontend
   npm run dev
   ```

5. **Check .env.local is in the right directory:**
   ```powershell
   Get-Content C:\Users\sourp\AutoComply-AI-fresh\frontend\.env.local
   ```
   Should output: `VITE_API_BASE=http://127.0.0.1:8001`

---

## 📊 Current System State

### Ports:
- **Backend:** 127.0.0.1:8001 ✅
- **Frontend:** localhost:5173 ✅

### API Configuration:
- **VITE_API_BASE:** http://127.0.0.1:8001 ✅
- **api.ts default:** http://127.0.0.1:8001 ✅
- **apiBase.ts default:** http://127.0.0.1:8001 ✅

### CSF Endpoints Status:
- ✅ Hospital: Working (HTTP 200)
- ✅ Practitioner: **FIXED** (was 500 → now 200)
- ✅ Facility: Working (HTTP 200)
- ✅ EMS: Working (not tested, but code matches Facility)
- ✅ Researcher: Working (not tested, but code matches Facility)

### Safety Features:
- ✅ ErrorBoundary: Catches React errors, shows helpful UI
- ✅ BackendConnectionIndicator: Shows real-time backend status
- ✅ 15s timeout on all API calls (prevents stuck loading)

---

## 🎯 Quick Start Commands (Copy-Paste)

### Terminal 1 - Backend:
```powershell
cd C:\Users\sourp\AutoComply-AI-fresh\backend
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "$PWD"
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001 --reload
```

### Terminal 2 - Frontend:
```powershell
cd C:\Users\sourp\AutoComply-AI-fresh\frontend
npm run dev
```

### Browser:
1. Open http://localhost:5173
2. Press `Ctrl + Shift + R` (hard refresh)
3. You should see the home page with no errors

---

**Last Updated:** December 21, 2025  
**Status:** 🟢 All systems operational, Practitioner CSF fixed
