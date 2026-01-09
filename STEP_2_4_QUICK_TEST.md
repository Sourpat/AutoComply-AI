# 🚀 Step 2.4 Quick Test Guide

**Feature:** Case Details Workspace (Split Pane + Tabs + Notes + Deep Link)

---

## 🎯 Quick Start (30 seconds)

```powershell
# Start the demo
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh
.\test_hitl_fixes.ps1

# Open console (as Verifier/Admin)
# http://localhost:5173/console
```

**Expected:** Auto-redirects to `/console/cases` (CaseWorkspace)

---

## ✅ Test 1: Split Pane Layout (30 seconds)

### Verify Layout:
1. **Left pane (35%):** Queue list with search/filter/sort
2. **Right pane (65%):** Case details with tabs
3. **Auto-selection:** First case auto-selected on load

### Expected Behavior:
- ✅ 2-column layout visible
- ✅ Left pane shows all cases
- ✅ Right pane shows selected case details
- ✅ Left pane is scrollable
- ✅ Right pane is scrollable independently

---

## ✅ Test 2: Case Selection & URL Sync (1 minute)

### Test URL Parameters:
1. **Click different cases** in left pane
   - ✅ URL updates: `?caseId=<id>`
   - ✅ Right pane updates immediately
   - ✅ Selected case highlighted (blue border)

2. **Copy URL** and open in new tab
   - ✅ Same case selected
   - ✅ Exact state restored

3. **Browser back/forward**
   - ✅ Case selection changes
   - ✅ URL reflects current case

### Expected Behavior:
- URL contains `?caseId=...`
- Shareable links work
- Browser navigation works

---

## ✅ Test 3: Summary Tab (1 minute)

### View Case Header:
- ✅ Status (color-coded)
- ✅ Priority (High/Medium/Low)
- ✅ Assigned To
- ✅ SLA (with overdue warning)
- ✅ Age
- ✅ Case ID

### Test Actions:
1. **Click "✓ Approve"** (if available)
   - ✅ Status changes to "approved"
   - ✅ Button disappears (no longer allowed)
   
2. **Click "👤 Assign"**
   - ✅ Dropdown shows verifiers
   - ✅ Select a verifier
   - ✅ Assigned To updates

3. **Click "📦 Export Packet"**
   - ✅ JSON file downloads
   - ✅ Contains case data

4. **Click "🔍 Open in RAG Explorer"**
   - ✅ Navigates to `/console/rag`
   - ✅ Connected mode selected
   - ✅ Case auto-loaded (autoload=1)

### Submission Snapshot:
- ✅ Shows submission ID
- ✅ Shows type (CSF type)
- ✅ Shows created/updated timestamps

---

## ✅ Test 4: Timeline Tab (30 seconds)

### Steps:
1. **Click "Timeline" tab**
   - ✅ Shows audit events
   - ✅ Events newest first
   - ✅ Icons for each event type

2. **Perform action** (e.g., assign case)
   - ✅ Timeline updates with new event
   - ✅ Shows actor name and role
   - ✅ Shows timestamp

### Expected Events:
- SUBMITTED
- ASSIGNED / UNASSIGNED
- APPROVED / BLOCKED / NEEDS_REVIEW
- REQUEST_INFO
- NOTE_ADDED

---

## ✅ Test 5: Notes Tab (2 minutes)

### Add Note:
1. **Click "Notes" tab**
2. **Enter note:** "Verified DEA number is valid"
3. **Click "Add Note"**
   - ✅ Note appears below input
   - ✅ Shows author name and role
   - ✅ Shows timestamp
   - ✅ Note body displayed

### Verify Persistence:
1. **Refresh page**
   - ✅ Note still visible
   - ✅ Stored in localStorage

### Delete Note:
1. **Click 🗑️ on note**
   - ✅ Note removed
   - ✅ localStorage updated

### Expected Format:
```
John Verifier (verifier)
Jan 6, 2026, 10:30:00 AM

Verified DEA number is valid
```

---

## ✅ Test 6: Attachments Tab (1 minute)

### Demo Notice:
- ✅ Shows banner: "📎 Demo Mode: Attachments are metadata-only"

### Add Attachment:
1. **Click "Attachments" tab**
2. **Enter filename:** `license-verification.pdf`
3. **Click "Add"**
   - ✅ Attachment appears in list
   - ✅ Shows 📄 icon
   - ✅ Shows filename
   - ✅ Shows uploader and timestamp

### Verify Persistence:
1. **Refresh page**
   - ✅ Attachment still visible
   - ✅ Stored in localStorage

### Delete Attachment:
1. **Click 🗑️ on attachment**
   - ✅ Attachment removed

---

## ✅ Test 7: Explainability Tab (30 seconds)

### Steps:
1. **Click "Explainability" tab**
   - ✅ Shows message: "Explainability features are available in RAG Explorer"
   - ✅ Shows "🔍 Open in RAG Explorer" button

2. **Click button**
   - ✅ Navigates to RAG Explorer
   - ✅ Connected mode active
   - ✅ Case preloaded

---

## ✅ Test 8: Deep Link to RAG Explorer (2 minutes)

### From Summary Tab:
1. **Open case in CaseWorkspace**
2. **Click "🔍 Open in RAG Explorer"**

### Verify RAG Explorer State:
- ✅ URL: `/console/rag?mode=connected&caseId=<id>&autoload=1`
- ✅ Connected mode selected (not sandbox)
- ✅ Submission dropdown shows case
- ✅ Explain automatically triggered (autoload=1)
- ✅ Results displayed without manual action

### Navigate Back:
1. **Click browser back button**
   - ✅ Returns to CaseWorkspace
   - ✅ Same case still selected
   - ✅ Tab state preserved

---

## ✅ Test 9: Integration with Search/Filter/Sort (1 minute)

### Left Pane Features:
1. **Search:** Type `hospital`
   - ✅ Queue filters to matching cases
   - ✅ Right pane shows first match

2. **Filter:** Click "Overdue"
   - ✅ Queue shows overdue cases only
   - ✅ Selection updates

3. **Sort:** Select "Priority (High→Low)"
   - ✅ Cases reorder
   - ✅ High priority cases first

### Expected Behavior:
- All Step 2.3 features work
- Search + filter + sort work together
- Selection persists during filtering

---

## ✅ Test 10: Role-Based Access (1 minute)

### Verifier/Admin:
1. **Login as Verifier or Admin**
2. **Navigate to `/console`**
   - ✅ Auto-redirects to `/console/cases`
   - ✅ CaseWorkspace loads

### Submitter:
1. **Switch role to Submitter**
2. **Navigate to `/console`**
   - ✅ Stays on ConsoleDashboard
   - ✅ Does NOT redirect to CaseWorkspace
   - ✅ Shows "My Submissions" view

---

## 🎨 Visual Checks

### Layout:
- ✅ Clean 2-column split (35% / 65%)
- ✅ No overlapping panels
- ✅ Scrollbars appear when needed
- ✅ Header shows "Case Workspace"

### Left Pane:
- ✅ Search bar at top
- ✅ Sort dropdown compact
- ✅ Views button (📁) compact
- ✅ Filter pills below search
- ✅ Item count shows
- ✅ Selected case has blue left border

### Right Pane:
- ✅ Case title and subtitle in header
- ✅ 5 tabs: Summary, Explainability, Timeline, Notes, Attachments
- ✅ Active tab highlighted (blue underline)
- ✅ Tab content fills pane
- ✅ Scrollable independently

### Tabs Content:
- ✅ **Summary:** Grid layout for info, action buttons visible
- ✅ **Explainability:** Centered message + button
- ✅ **Timeline:** Events stacked vertically
- ✅ **Notes:** Input at top, notes below
- ✅ **Attachments:** Demo banner + file list

---

## 🐛 Edge Cases to Test

### Empty States:
1. **No notes yet**
   - ✅ Shows "No notes yet" (italic)

2. **No attachments**
   - ✅ Shows "No attachments" (italic)

3. **No audit events**
   - ✅ Timeline shows minimal state

### Long Content:
1. **Add 5+ notes**
   - ✅ Scrollable within tab
   - ✅ Newest first order

2. **Long case title**
   - ✅ Truncates gracefully
   - ✅ No layout break

### URL Params:
1. **Invalid caseId:** `/console/cases?caseId=invalid-id`
   - ✅ Shows "Case not found"

2. **No caseId:** `/console/cases`
   - ✅ Auto-selects first case
   - ✅ URL updates

---

## 📊 Performance Checks

### Case Selection:
- ✅ Instant response (<100ms)
- ✅ No flickering

### Tab Switching:
- ✅ Instant tab change
- ✅ No re-fetching data

### Notes/Attachments:
- ✅ Add/delete instant
- ✅ No lag with 10+ items

---

## ✅ Success Criteria

All tests pass if:
- ✅ 2-column layout works perfectly
- ✅ Case selection updates URL
- ✅ All 5 tabs render correctly
- ✅ Notes persist in localStorage
- ✅ Attachments persist (demo mode)
- ✅ Deep link to RAG Explorer works
- ✅ Connected mode auto-loads case
- ✅ Verifier/Admin redirects to CaseWorkspace
- ✅ Submitter stays on ConsoleDashboard
- ✅ No console errors
- ✅ Build passes (1.37s, 689.44 kB)

---

## 🔧 Troubleshooting

### CaseWorkspace not loading:
- Check role (verifier/admin required)
- Check URL: `/console/cases`
- Check console for errors

### Right pane blank:
- Verify caseId in URL
- Check if case exists in demoStore
- Refresh page to reset

### Notes not persisting:
- Check localStorage key: `acai.caseNotes.v1`
- Verify JSON structure
- Clear localStorage and retry

### Deep link not working:
- Check URL params: `mode=connected&caseId=...&autoload=1`
- Verify RAG Explorer supports params
- Check console for navigation errors

---

## 🎉 Expected Demo Flow

**Case Workspace Demo:**

> "Let me show you our new Case Workspace. When I login as a verifier..."  
> *(Navigate to /console)* → Auto-redirects to CaseWorkspace  
>
> "On the left, I have my full queue with search and filters..."  
> *(Search: `hospital`)* → Queue filters  
>
> "On the right, I see the complete case details with tabs..."  
> *(Click case)* → Details load  
>
> "I can add internal notes for my team..."  
> *(Add note: "Verified")* → Note saved  
>
> "And when I need deeper analysis..."  
> *(Click "Open in RAG Explorer")* → RAG loads automatically  
>
> "The case is already loaded and explained. No manual steps."  
> → Evidence displayed, rules shown  
>
> "I can share this exact view with my team..."  
> *(Copy URL)* → Shareable link created  

**Result:** ✨ Professional enterprise case review workspace

---

**Time to Test:** ~10-15 minutes for full workflow  
**Status:** ✅ READY FOR DEMO  
**Version:** Step 2.4 Complete

---

## 📋 Quick Checklist

- [ ] CaseWorkspace loads at `/console/cases`
- [ ] Verifier/Admin auto-redirected
- [ ] 2-column layout renders
- [ ] Case selection updates URL
- [ ] Summary tab shows all info
- [ ] Actions work (Approve, Assign, Export)
- [ ] Timeline shows audit events
- [ ] Notes can be added/deleted
- [ ] Attachments can be added/deleted (demo)
- [ ] Explainability redirects to RAG
- [ ] Deep link preloads case in RAG
- [ ] Connected mode auto-triggers
- [ ] Search/filter/sort still work
- [ ] Build passes (no errors)

**All items checked? → Step 2.4 COMPLETE! 🎊**
