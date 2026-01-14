# 🚀 Step 2.3 Quick Test Guide

**Feature:** Enterprise Queue Navigation (Search, Sort, Saved Views, URL Sync)

---

## 🎯 Quick Start (30 seconds)

```powershell
# Start the demo
cd C:\Users\soura\Documents\Projects\Projects\AutoComply-AI-fresh
.\test_hitl_fixes.ps1
```

**Open:** http://localhost:5173/console  
**Role:** Switch to **Verifier** or **Admin**

---

## ✅ Test 1: Search Functionality (1 minute)

### Steps:
1. **Enter search:** `ohio`
   - ✅ Should filter to Ohio-related cases
   
2. **Add token:** `ohio hospital`
   - ✅ Should filter to Ohio Hospital cases only
   
3. **Add more:** `ohio hospital morphine`
   - ✅ Should filter to Ohio Hospital morphine cases
   
4. **Clear search:** Click ✕ button
   - ✅ Should show all cases again

### Expected Behavior:
- Search updates **instantly** (no lag)
- Case count badge updates
- Multi-token uses **AND logic** (all tokens must match)
- Search is **case-insensitive**

---

## ✅ Test 2: Sorting (1 minute)

### Steps:
1. **Select "🔴 Priority (High→Low)"**
   - ✅ High priority cases appear first
   - ✅ Red/amber priorities at top

2. **Select "⏰ Oldest First"**
   - ✅ Oldest cases (higher age) appear first
   - ✅ Age column shows oldest at top

3. **Select "👤 Assignee (A→Z)"**
   - ✅ Cases sorted alphabetically by assignee
   - ✅ Unassigned cases grouped together

4. **Select "⚠️ Overdue First" (default)**
   - ✅ Overdue cases (red SLA) appear first
   - ✅ Then by priority, then by age

### Expected Behavior:
- Sort applies **immediately** on selection
- Items re-order smoothly
- Works with search + filters

---

## ✅ Test 3: Saved Views (2 minutes)

### Save a View:
1. **Set up state:**
   - Search: `hospital`
   - Filter: Click "Overdue"
   - Sort: Select "Priority (High→Low)"

2. **Save view:**
   - Click "📁 Views" button
   - Click "+ Save Current View"
   - Enter name: `Overdue Hospitals`
   - ✅ Check "Set as default view"
   - Click "Save View"

3. **Verify save:**
   - ✅ View appears in dropdown with ⭐
   - ✅ View name shows "Overdue Hospitals"

### Load a View:
1. **Change state:**
   - Clear search
   - Click "All" filter
   - Change sort to "Oldest First"

2. **Load saved view:**
   - Click "📁 Views"
   - Click "Overdue Hospitals"

3. **Verify restore:**
   - ✅ Search shows "hospital"
   - ✅ Filter shows "Overdue" active
   - ✅ Sort shows "Priority (High→Low)"

### Delete a View:
1. Click "📁 Views"
2. Click 🗑️ next to "Overdue Hospitals"
3. ✅ View removed from dropdown

### Expected Behavior:
- Views persist **after page refresh**
- Default view (⭐) loads on startup
- Delete immediately removes view

---

## ✅ Test 4: URL Synchronization (1 minute)

### Test URL Updates:
1. **Set state:**
   - Search: `ohio`
   - Sort: "Age (Oldest First)"
   - Filter: "My Cases"

2. **Check URL:**
   - ✅ URL shows: `?q=ohio&sort=age&dir=asc&filter=mine`

3. **Change search:** Add `hospital` → `ohio hospital`
   - ✅ URL updates: `?q=ohio+hospital&sort=age&dir=asc&filter=mine`

### Test URL Restore:
1. **Copy URL** from address bar
2. **Open new tab** and paste URL
3. **Verify state restored:**
   - ✅ Search shows "ohio hospital"
   - ✅ Sort shows "Oldest First"
   - ✅ Filter shows "My Cases" active

### Expected Behavior:
- URL updates **without page reload**
- URL is **shareable** (works in new tab)
- Browser back/forward work correctly

---

## ✅ Test 5: Integration (2 minutes)

### Search + Bulk Actions:
1. Search: `hospital`
2. ✅ Select multiple filtered cases (checkboxes)
3. ✅ Use bulk assign/status change
4. ✅ Bulk actions work on filtered results

### Search + Filters + Sort:
1. Search: `ohio`
2. Filter: "Overdue"
3. Sort: "Priority (High→Low)"
4. ✅ All three work together harmoniously

### Search + Case Details:
1. Search: `morphine`
2. Click case to open details drawer
3. ✅ Timeline shows correct case
4. Close drawer
5. ✅ Search state preserved

---

## 🎨 Visual Checks

### Search Bar:
- ✅ Full-width input with placeholder
- ✅ Clear button (✕) appears when typing
- ✅ Border highlights on focus (blue ring)

### Sort Dropdown:
- ✅ Shows current sort with emoji
- ✅ Dropdown has 9 options
- ✅ Selected option highlighted

### Views Dropdown:
- ✅ "📁 Views" button next to sort
- ✅ Dropdown shows saved views
- ✅ Default view has ⭐ icon
- ✅ Delete button (🗑️) on each view
- ✅ "+ Save Current View" at bottom

### Save View Modal:
- ✅ Centered overlay with backdrop
- ✅ Name input field
- ✅ "Set as default" checkbox
- ✅ Save/Cancel buttons
- ✅ Save disabled when name empty

---

## 🐛 Edge Cases to Test

### Empty Results:
1. Search: `zzzzz` (nonsense)
   - ✅ No cases shown
   - ✅ Item count shows "0 items"
   - ✅ No errors in console

### Special Characters:
1. Search: `ohio-hospital`
   - ✅ Handles hyphens correctly
2. Search: `"morphine"`
   - ✅ Handles quotes correctly

### Long View Names:
1. Save view with name: `This is a very long view name for testing overflow behavior`
   - ✅ Truncates or wraps gracefully in dropdown

### Multiple Views:
1. Save 5+ views
   - ✅ Dropdown scrolls if needed
   - ✅ All views accessible

---

## 📊 Performance Checks

### Search Performance:
- ✅ Typing feels **instant** (no lag)
- ✅ No visible delay with 50+ cases

### Sort Performance:
- ✅ Sort change is **immediate**
- ✅ No flickering or jumps

### URL Performance:
- ✅ No page reload on state change
- ✅ History doesn't grow excessively

---

## ✅ Success Criteria

All tests pass if:
- ✅ Search filters cases correctly
- ✅ Multi-token AND logic works
- ✅ 9 sort options work
- ✅ Views save and load correctly
- ✅ URL syncs and restores state
- ✅ Integration with filters/bulk actions works
- ✅ No console errors
- ✅ UI is responsive and polished

---

## 🔧 Troubleshooting

### Search not filtering:
- Check console for errors
- Verify search tokens are correct
- Ensure cases have searchable text

### Sort not working:
- Check if items have sort field values
- Verify sort field enum matches dropdown

### Views not persisting:
- Check localStorage in DevTools
- Look for key: `acai.queueViews.v1`
- Verify JSON structure is valid

### URL not updating:
- Check React Router version
- Verify `useSearchParams` import
- Look for errors in useEffect

---

## 🎉 Expected Demo Flow

**Enterprise Queue Navigation Demo:**

> "Let me show you our advanced queue navigation. I'll search for hospital cases..."  
> *(Type: `hospital`)* → 5 cases shown  
>
> "Now I'll narrow it to Ohio hospitals with morphine..."  
> *(Add: `ohio morphine`)* → 1-2 cases shown  
>
> "I can sort by priority to see high-risk cases first..."  
> *(Select: Priority High→Low)* → Cases reorder  
>
> "Let me save this as a reusable view..."  
> *(Save view: "Critical Hospital Cases")* → View saved  
>
> "Now I can share this exact view with my team..."  
> *(Copy URL)* → Shareable link created  
>
> "If I change the queue and come back..."  
> *(Load saved view)* → State restored instantly  

**Result:** ✨ Professional, enterprise-grade queue management

---

**Time to Test:** ~5-10 minutes  
**Status:** ✅ READY FOR DEMO  
**Version:** Step 2.3 Complete
