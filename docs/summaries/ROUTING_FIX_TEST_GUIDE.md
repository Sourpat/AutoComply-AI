# 🔍 Quick Test - Routing Fix Verification

## Start the Application

```powershell
# Terminal 1: Backend (port 8001)
cd backend
.\.venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001

# Terminal 2: Frontend
cd frontend
npm run dev
```

Open: **http://localhost:5173**

---

## Test 1: Dashboard Route ✅

1. Navigate to: `http://localhost:5173/console`
2. **Expected**: Compliance Snapshot page
3. **Should see**:
   - Hero metrics row (compliance posture, CSF decisions, etc.)
   - Verification queue section
   - "Open RAG Explorer" button in alerts
4. **Should NOT see**:
   - "How to use this page" helper box
   - Regulatory Knowledge search panel
   - Decision explainability section

---

## Test 2: RAG Explorer Route ✅

1. Navigate to: `http://localhost:5173/console/rag`
2. **Expected**: RAG Explorer page
3. **Should see**:
   - "Regulatory RAG Explorer" title
   - "How to use this page" helper box
   - Section 1: Search the knowledge base
   - Section 2: Decision explainability
   - Section 3: Document preview
4. **Should NOT see**:
   - Hero metrics row
   - Compliance posture cards
   - Verification queue

---

## Test 3: Navigation ✅

1. Start on Dashboard (`/console`)
2. Click **"RAG Explorer"** in sidebar
3. **Expected**: 
   - URL changes to `/console/rag`
   - Content switches to RAG Explorer
   - Active nav indicator moves to RAG Explorer
4. Click **"Dashboard"** in sidebar
5. **Expected**:
   - URL changes to `/console`
   - Content switches to Dashboard
   - Active nav indicator moves to Dashboard

---

## Test 4: View Snippet Toggle ✅

1. Go to RAG Explorer → Section 1: Search
2. Enter query: `"DEA registration"`
3. Click **Search**
4. In results cards, click **"View snippet"** button
5. **Expected**:
   - Card expands
   - Full snippet text displays in code block
   - Button changes to **"Hide"**
6. Click **"Hide"**
7. **Expected**:
   - Card collapses
   - Snippet preview (2 lines) shows
   - Button changes to **"View snippet"**

---

## Test 5: Connected Mode (Debug Logs) 🔧

**Prerequisite**: Submit a CSF form first
1. Go to `/console` → Verification Queue
2. Click **"Submit New CSF"** or use existing form
3. Complete and submit

**Test Connected Mode**:
1. Open **Browser DevTools** → Console tab
2. Go to RAG Explorer → Section 2: Decision explainability
3. Change **"Decision Source"** to: **"Last CSF Submission (Connected Mode)"**
4. Click **"Load Last Decision"**
5. **Check console for**:
   ```
   Loaded submission from <date>
   ```
6. Click **"Explain Decision"**
7. **Check console for**:
   ```
   Connected mode - using loaded decision: {
     engine_family: "csf",
     decision_type: "csf_practitioner",
     evidence: { ... }
   }
   ragExplain response: {
     debug: {
       fired_rules: [...],
       outcome: "approved" | "blocked" | "needs_review"
     }
   }
   ```

8. **Expected on page**:
   - If `fired_rules.length > 0`: Shows decision summary + fired rules
   - If `fired_rules.length === 0`: Shows "No rules fired" message

**If still seeing "No rules fired"**:
- Check console logs to verify evidence structure
- Check backend logs for evaluator errors
- Verify CSF submission saved correctly

---

## Test 6: Open RAG Explorer Button ✅

1. Go to Dashboard (`/console`)
2. Scroll to **"RAG source review"** alert section
3. Click **"Open RAG Explorer"** button
4. **Expected**:
   - Navigates to `/console/rag`
   - RAG Explorer page loads

---

## Known Issues (Pending Fixes)

These issues were reported but not yet fixed:

### A. Text Formatting Issues
- [ ] Literal `\n` showing in Missing Evidence text
- [ ] Unwanted dash separator in output
- [ ] Poor contrast in decision cards

### B. Deep Linking (Not Implemented)
- [ ] Query param support: `?mode=connected&caseId=ACC-123`
- [ ] "Open trace" button doesn't link to connected RAG

---

## Success Checklist ✅

After running all tests, verify:

- [✅] Dashboard and RAG routes are completely separate (no shared content)
- [✅] Navigation between pages works smoothly
- [✅] URL changes correctly when switching pages
- [✅] View snippet toggle expands/collapses properly
- [🔧] Connected mode logs appear in console (helps debug "No rules fired")

---

## If Something Doesn't Work

1. **Check frontend console** for errors
2. **Check backend terminal** for API errors
3. **Hard refresh** browser (`Ctrl+Shift+R`)
4. **Clear browser cache** and reload
5. **Rebuild frontend**: `npm run build` in frontend directory
6. **Restart backend**: Stop and re-run uvicorn command

---

## Next Steps After Verification

If routing works correctly but connected mode still shows "No rules fired":
1. The debug logs will show what evidence is being sent
2. Check if backend evaluator is processing evidence correctly
3. May need to debug backend decision evaluation logic

If text formatting issues persist:
1. Find where literal `\n` is rendered
2. Add text sanitization: `.replace(/\\n/g, ' ')`
3. Update text colors to higher contrast variants
