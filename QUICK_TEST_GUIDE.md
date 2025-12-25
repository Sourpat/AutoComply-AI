# Quick Start - Testing HITL Production Fixes

## Prerequisites
- Backend virtual environment set up
- Frontend dependencies installed

## 1. Reset and Seed Demo Data

```powershell
# In backend directory
cd backend
.venv\Scripts\python scripts\migrate_add_reason_codes.py
.venv\Scripts\python scripts\seed_kb.py
```

## 2. Start Servers

### Terminal 1 - Backend
```powershell
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

### Terminal 2 - Frontend
```powershell
cd frontend
npm run dev
```

## 3. Test Jurisdiction Bug Fix (THE MAIN FIX)

Navigate to: http://localhost:5173/chat

### Question 1: New Jersey (should ANSWER)
```
What are Schedule IV shipping rules for New Jersey?
```

**✅ Expected Result:**
- Full detailed answer about NJ requirements
- Decision trace shows "ANSWERED"
- Similarity score ~90%+

### Question 2: Rhode Island (should REVIEW - not reuse NJ!)
```
What are Schedule IV shipping rules for Rhode Island?
```

**✅ Expected Result:**
- "Thank you for your question. This query has been submitted for review..."
- Decision trace shows "NEEDS_REVIEW"
- reason_code: "jurisdiction_mismatch"
- Does NOT show NJ answer (this was the bug!)

### Question 3: California (should ANSWER)
```
What are Schedule IV shipping rules for California?
```

**✅ Expected Result:**
- Full detailed answer about CA requirements (different from NJ)
- Mentions CURES reporting
- Decision trace shows "ANSWERED"

## 4. Test Generic Questions

### Question 4: No state mentioned (should ANSWER)
```
What is a Schedule II drug?
```

**✅ Expected Result:**
- Generic answer about Schedule II classification
- Decision trace shows "ANSWERED"
- Works because no state filtering needed

## 5. Test Unknown Questions

### Question 5: Completely new topic (should REVIEW)
```
How do I get a DEA license in Texas?
```

**✅ Expected Result:**
- NEEDS_REVIEW message
- Decision trace shows reason_code: "low_similarity" or "no_kb_match"
- Creates queue item

## 6. Test Admin Review Queue

Navigate to: http://localhost:5173/admin/review

**✅ Expected:**
- See question #2 (Rhode Island) with reason "jurisdiction_mismatch"
- See question #5 (Texas DEA) with reason "low_similarity"
- Each shows draft answer with context

## 7. Test Demo Reset

On Admin Review page:

1. Click "🔄 Reset Demo" button
2. Confirm dialog
3. **✅ Expected:**
   - Success message with counts
   - Queue empties
   - Can repeat all tests with clean state

## Quick Verification Checklist

- [ ] NJ question returns NJ-specific answer
- [ ] RI question returns NEEDS_REVIEW (NOT NJ answer)
- [ ] CA question returns CA-specific answer
- [ ] Generic question (no state) works fine
- [ ] Unknown questions create review items
- [ ] No 500 errors appear in UI
- [ ] Decision traces are visible
- [ ] Reset Demo button works

## Troubleshooting

### Backend not starting
```powershell
# Ensure venv is activated
cd backend
.venv\Scripts\Activate.ps1

# Check dependencies
pip install -r requirements.txt
```

### Frontend not starting
```powershell
cd frontend
npm install
npm run dev
```

### Database errors
```powershell
# Delete and recreate
cd backend
rm data/autocomply.db
.venv\Scripts\python scripts\seed_kb.py
```

### CORS errors
- Ensure backend is on port 8001
- Ensure frontend is on port 5173
- Check browser console for actual error

## Key Success Metrics

1. **No State Leakage:** RI question does NOT return NJ answer ✅
2. **Jurisdiction Filtering:** State-specific questions only match same-state KB entries ✅
3. **Graceful Errors:** No 500s, all errors → NEEDS_REVIEW ✅
4. **Clean UX:** Users never see draft markdown ✅
5. **Admin Tools:** Reset Demo works ✅

## Demo Flow for Portfolio

1. **Show working answers:**
   - "What is a Schedule II drug?" → Instant answer
   - "What are Schedule IV shipping rules for New Jersey?" → NJ-specific answer

2. **Show jurisdiction filtering:**
   - "What are Schedule IV shipping rules for Rhode Island?" → NEEDS_REVIEW
   - Click decision trace to show "jurisdiction_mismatch"

3. **Show review queue:**
   - Navigate to /admin/review
   - Show RI question with draft context
   - Explain human-in-the-loop workflow

4. **Show reset capability:**
   - Click Reset Demo
   - Refresh chat, show clean slate
   - Repeat demo

## Logs to Watch

### Backend terminal should show:
```
[Q:What are Schedule IV...] Starting KB search
[Q:What are Schedule IV...] KB search completed - best_match: True, requested_state: NJ
[Q:What are Schedule IV...] KB match found with score 0.92 - returning published answer

[Q:What are Schedule IV...] Starting KB search
[Q:What are Schedule IV...] KB search completed - best_match: False, requested_state: RI, jurisdiction_mismatch: True
[Q:What are Schedule IV...] Jurisdiction mismatch: requested RI, no compatible KB entry found
```

### Frontend decision traces should show:
- NJ: `gating_decision: "ANSWERED"`, no reason_code
- RI: `gating_decision: "NEEDS_REVIEW"`, `reason_code: "jurisdiction_mismatch"`

---

**Time to test:** ~5 minutes
**Setup time:** ~2 minutes
**Total:** ~7 minutes for full verification
