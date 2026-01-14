# Quick Test Guide: Step 2.8 Backend Integration

## Prerequisites
- Backend on port 8001 (optional - tests both modes)
- Frontend on port 5173

## Test 1: Backend Connected Mode (5 min)

### Setup
```powershell
# Terminal 1: Start backend
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001

# Terminal 2: Start frontend  
cd frontend
npm run dev

# Terminal 3: Monitor backend logs
# Watch for POST requests
```

### Test Steps
1. Open http://localhost:5173
2. Go to CSF Practitioner form
3. Fill form and submit
4. **Expected Console Logs:**
   ```
   [SubmissionIntake] Starting intake for submission: sub_xxxxx
   [SubmissionIntake] Using backend API to create case
   [SubmissionIntake] Created case via backend: case_xxxxx
   [SubmissionIntake] Attached evidence via backend: N
   ```
5. Click "Open Case" button
6. **Expected:** Navigate to Console dashboard with case selected
7. **Expected Network Calls:**
   - `POST /submissions` - 200 OK
   - `POST /workflow/cases` - 200 OK  
   - `POST /workflow/cases/{id}/evidence/attach` - 200 OK
8. Refresh page
9. **Expected:** Case still visible (persisted in backend)

### Verification
- [ ] Case appears in work queue
- [ ] Case has correct status (NEW or NEEDS_REVIEW)
- [ ] SLA due date is set
- [ ] Timeline shows audit events
- [ ] Evidence tab has RAG results
- [ ] Submission tab shows form data
- [ ] Console logs show "Using backend API"

---

## Test 2: LocalStorage Fallback Mode (3 min)

### Setup
```powershell
# Stop backend (or don't start it)
# Keep frontend running

# Or in browser console:
# Clear previous data
localStorage.clear()
```

### Test Steps
1. Open http://localhost:5173
2. Go to CSF Practitioner form
3. Fill form and submit
4. **Expected Console Logs:**
   ```
   [SubmissionIntake] Starting intake for submission: sub_xxxxx
   [SubmissionIntake] Backend unavailable, using localStorage: Error...
   [SubmissionIntake] Created case via localStorage: case_xxxxx
   [SubmissionIntake] Attached evidence to localStorage case: { count: N, ... }
   ```
5. Click "Open Case" button
6. **Expected:** Navigate to Console dashboard with case selected
7. **Expected Network Calls:**
   - `POST /workflow/health` - Failed (timeout or 404)
   - No POST /submissions
   - No POST /workflow/cases
8. Refresh page
9. **Expected:** Case still visible (persisted in localStorage)

### Verification
- [ ] Case appears in work queue
- [ ] Case has correct status
- [ ] SLA due date is set
- [ ] Timeline shows 3 audit events (submitted, created, evidence)
- [ ] Evidence tab has RAG results
- [ ] Submission tab shows form data
- [ ] Console logs show "Backend unavailable, using localStorage"

---

## Test 3: Failover Behavior (3 min)

### Setup
```powershell
# Start with backend running
```

### Test Steps
1. Submit form with backend running → Creates case in backend
2. Stop backend server
3. Submit another form → Creates case in localStorage
4. Restart backend
5. Submit third form → Creates case in backend

### Expected Results
**Case 1:** Persists in backend, visible when backend running
**Case 2:** Only in localStorage, lost when backend comes back online
**Case 3:** Persists in backend

### Notes
- Cases 1 and 3 query backend DB
- Case 2 exists only in browser localStorage
- This is expected behavior - no sync between modes

---

## Debugging Tips

### Backend Not Detected
```javascript
// Check in browser console:
fetch('http://localhost:8001/workflow/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)

// Expected: { "ok": true }
```

### Check Backend Logs
```powershell
# In backend terminal, should see:
INFO:     127.0.0.1:xxxxx - "POST /workflow/cases HTTP/1.1" 200 OK
INFO:     127.0.0.1:xxxxx - "POST /workflow/cases/{id}/evidence/attach HTTP/1.1" 200 OK
```

### Check localStorage
```javascript
// In browser console:
console.log(localStorage.getItem('workQueue'))
console.log(localStorage.getItem('submissions'))
```

### Force Mode Switch
```javascript
// Force backend mode (even if offline):
// Edit submissionIntakeService.ts line ~305:
// if (healthCheck?.ok) { ... }
// Change to: if (true) { ... }

// Force localStorage mode (even if online):
// Change to: if (false) { ... }
```

---

## Common Issues

### Issue: Backend creates case but frontend shows localStorage
**Solution:** Clear browser cache and localStorage
```javascript
localStorage.clear()
location.reload()
```

### Issue: Evidence not attaching
**Check:**
1. RAG search returning results? (Check Network tab)
2. Evidence array populated? (Check console logs)
3. Backend receiving attach request? (Check backend logs)

### Issue: Case not persisting after refresh
**Backend mode:** Check backend logs - case should be in memory store
**LocalStorage mode:** Check localStorage in DevTools

### Issue: Health check always timing out
**Check:**
1. Backend actually running on port 8001?
2. CORS enabled? (Should be - check backend startup logs)
3. Network timeout too short? (Currently 2s)

---

## Success Criteria

✅ **Both modes work identically from user perspective:**
- Submit form → Success banner
- Click "Open Case" → Navigate to Console
- Case visible with correct data
- Timeline shows events
- Evidence attached
- Deep link works

✅ **Automatic fallback:**
- No manual mode switching
- No errors when backend unavailable
- Graceful degradation

✅ **Data persistence:**
- Backend mode: Cases persist across sessions
- LocalStorage mode: Cases persist in browser

✅ **Console logging:**
- Clear indication of which mode used
- No errors in console (warnings OK)
