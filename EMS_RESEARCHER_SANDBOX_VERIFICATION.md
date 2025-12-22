# EMS & Researcher CSF Sandbox Verification

## Date: 2024
## Issue: Blank page rendering on specific user actions

---

## 🔍 **REPRODUCTION STEPS**

### **EMS CSF Sandbox**
1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:5173/csf/ems`
3. Open Browser DevTools Console (F12)
4. Fill in any form fields
5. Click **"Check & Explain"** button
6. **Expected error**: Console should show error stack trace (if any)
7. **With ErrorBoundary**: Error panel should appear instead of blank page

### **Researcher CSF Sandbox**
1. Navigate to: `http://localhost:5173/csf/researcher`
2. Open Browser DevTools Console (F12)
3. Click any scenario pill (e.g., "Research Institution OK")
4. Verify pill highlights with blue border + ring
5. Click **"Evaluate"** button
6. **Expected error**: Console should show error stack trace (if any)
7. **With ErrorBoundary**: Error panel should appear instead of blank page

---

## ✅ **FIXES APPLIED**

### **1. ErrorBoundary Component**
- **File**: `frontend/src/components/ErrorBoundary.tsx`
- **Purpose**: Catch React render errors and prevent complete white screen
- **Features**:
  - Displays error message and stack trace in styled panel
  - "Reset" button to attempt recovery
  - Logs errors to console for debugging

### **2. Wrapped Sandboxes in ErrorBoundary**
- **File**: `frontend/src/pages/CsfOverviewPage.tsx`
- **Change**: Wrapped `{meta.component}` in `<ErrorBoundary>`
- **Effect**: Any sandbox crash now shows error UI instead of blank page

### **3. Enhanced Error Logging**
- **Files**:
  - `frontend/src/components/EmsCsfSandbox.tsx`
  - `frontend/src/components/ResearcherCsfSandbox.tsx`
- **Changes**: Added `console.error("[Sandbox] Operation failed:", err)` to:
  - `evaluateEmsCsf()` / `evaluateResearcherCsf()`
  - `runEmsCsfCopilot()` / `runResearcherCsfCopilot()`
  - `explainCsfDecision()` calls
- **Effect**: All errors now logged with clear prefixes for debugging

### **4. Researcher Scenario Pill Highlighting**
- **File**: `frontend/src/components/ResearcherCsfSandbox.tsx`
- **Changes**:
  - Added `selectedExampleId` state tracking
  - Updated `applyResearcherExample()` to set `selectedExampleId`
  - Applied conditional styling:
    ```tsx
    isActive
      ? "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-200"
      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50"
    ```
- **Effect**: Pills now highlight like Hospital/Practitioner sandboxes

### **5. Consistent Styling**
- **Button sizing**: All buttons use `text-[11px]` for consistency
- **Test banner**: Blue background with `text-blue-900` for contrast
- **Scenario pills**: Proper border, ring, and hover states

---

## 🧪 **VERIFICATION CHECKLIST**

### **EMS CSF Sandbox**
- [ ] Page loads without blank screen
- [ ] "Check & Explain" button works
- [ ] If error occurs, ErrorBoundary shows error panel (not white screen)
- [ ] Console shows `[EMS CSF] Copilot failed:` with stack trace if error
- [ ] Copilot staleness tracking works (yellow banner on form change)
- [ ] Test banner has good contrast (blue background, dark text)

### **Researcher CSF Sandbox**
- [ ] Page loads without blank screen
- [ ] Scenario pills highlight when clicked (blue border + ring)
- [ ] Only one pill is highlighted at a time
- [ ] "Evaluate" button works
- [ ] If error occurs, ErrorBoundary shows error panel (not white screen)
- [ ] Console shows `[Researcher CSF] Evaluate failed:` with stack trace if error
- [ ] Copilot staleness tracking works
- [ ] Scenario pill text is readable with proper contrast

### **General ErrorBoundary**
- [ ] Error panel shows clear error message
- [ ] Stack trace is visible in error panel
- [ ] "Reset" button allows recovery attempt
- [ ] Errors logged to console with component prefix

---

## 🔧 **DEBUGGING BLANK PAGES**

### **If blank page still occurs:**

1. **Check Console First**
   ```
   Open DevTools → Console tab
   Look for errors in red
   Check for prefixes: [EMS CSF], [Researcher CSF], [React]
   ```

2. **Check Network Tab**
   ```
   DevTools → Network tab
   Filter: XHR/Fetch
   Look for failed API calls (red status codes)
   Check response body for error details
   ```

3. **Common Causes**
   - **Undefined access**: `decision.field` when `decision` is null
     - **Fix**: Use optional chaining: `decision?.field ?? []`
   
   - **API endpoint mismatch**: Frontend calling wrong URL
     - **Fix**: Verify `csfEmsCopilotClient.ts` and `csfResearcherCopilotClient.ts` endpoints
   
   - **Navigation during render**: `window.location.href = ...` in render path
     - **Fix**: Move navigation to event handlers, use `<button type="button">`
   
   - **Missing import**: Component or hook imported but not exported
     - **Fix**: Check import paths, verify exports in source files

4. **Expected Console Output** (on error)
   ```
   [EMS CSF] Copilot failed: Error: Network request failed
       at callEmsCopilot (csfEmsCopilotClient.ts:15)
       at runEmsCsfCopilot (EmsCsfSandbox.tsx:275)
       ...
   ```

---

## 📊 **COMPARISON WITH WORKING SANDBOXES**

| Feature | Hospital | Practitioner | Facility | EMS | Researcher |
|---------|----------|--------------|----------|-----|------------|
| ErrorBoundary | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scenario Pills Highlight | ✅ | ✅ | N/A | N/A | ✅ |
| Copilot Staleness | ✅ | ✅ | ✅ | ✅ | ✅ |
| Console Error Logging | ✅ | ✅ | ✅ | ✅ | ✅ |
| Test Banner Contrast | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dev UI Gating | N/A | N/A | ✅ | N/A | N/A |

---

## 🎯 **SUCCESS CRITERIA**

✅ **No blank white screens** - ErrorBoundary catches all render errors  
✅ **All errors logged** - Console shows clear error traces with component prefixes  
✅ **Scenario pills work** - Researcher pills highlight on click like Practitioner  
✅ **Copilot staleness** - Both sandboxes show yellow banner on form changes  
✅ **Consistent styling** - Font sizes, colors, spacing match other sandboxes  

---

## 📝 **NOTES FOR FUTURE DEBUGGING**

- **Always open DevTools Console before testing** - Errors may be silent without it
- **ErrorBoundary is not a fix** - It prevents white screens but still need to fix root cause
- **Check `componentDidCatch` logs** - ErrorBoundary logs full error details
- **API errors won't trigger ErrorBoundary** - They're caught in try/catch blocks
- **Navigation issues** - Check for `<a href>` tags, should be `<button type="button">`
