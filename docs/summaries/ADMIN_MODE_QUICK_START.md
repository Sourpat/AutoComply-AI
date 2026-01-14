# Quick Start - Admin Mode (No DevTools!)

## 🚀 Fastest Way to Enable Admin Mode

### Method 1: URL (RECOMMENDED - 5 seconds)

**Just navigate to:**
```
http://localhost:5173/console?admin=true
```

**Done!** Admin mode is now enabled. You'll see:
- ✅ Amber badge: "🛡️ Admin Mode"
- ✅ Amber button: "Disable Admin"
- ✅ Action buttons on work queue items

---

### Method 2: UI Button (10 seconds)

1. Go to: `http://localhost:5173/console`
2. Click: **"Enable Admin"** button (top-right)
3. Page reloads automatically

**Done!** Same result as Method 1.

---

## 📋 What You Can Do Now

### Review a Submission

1. **Submit a CSF** (any type):
   - Practitioner: `/csf/practitioner`
   - Facility: `/csf/facility`  
   - Hospital: `/csf/hospital`

2. **Go to work queue**: `/console` (scroll to "Verification Work Queue")

3. **Find your submission** and click:
   - **[Start Review]** - Marks as "in review"
   - **[Notes]** - Add review comments
   - **[Approve]** or **[Reject]** - Final decision

### Check Submission Status

Look for these status badges:
- **Blue** = submitted (awaiting review)
- **Purple** = in_review (actively reviewing)
- **Green** = approved (final approval)
- **Red** = rejected (final rejection)

---

## 🎯 Action Buttons Reference

| Status | Buttons Available |
|--------|-------------------|
| **submitted** | [Start Review] [Notes] |
| **in_review** | [Approve] [Reject] [Notes] |
| **approved** | [Notes] (read-only) |
| **rejected** | [Notes] (read-only) |

---

## ⚠️ Disable Admin Mode

### Option 1: Click Button
- Click **"Disable Admin"** button in console header
- Page reloads
- Admin mode disabled

### Option 2: DevTools (if needed)
```javascript
localStorage.removeItem('admin_unlocked');
location.reload();
```

---

## 🔍 Check If Admin Mode Is Active

**Look for these indicators:**

✅ **Admin Enabled:**
- Amber badge: "🛡️ Admin Mode"
- Button says: "Disable Admin" (amber color)
- Action buttons visible on submissions

❌ **Admin Disabled:**
- No badge
- Button says: "Enable Admin" (gray color)
- Warning: "⚠️ Read-only (Admin unlock required)"
- Action buttons hidden

---

## 💡 Tips

### Bookmark This URL
```
http://localhost:5173/console?admin=true
```
Opens console with admin mode auto-enabled.

### Share With Team
Send the URL above to team members - they get admin mode automatically.

### Cross-Tab Sync
Enable admin in one tab, it updates in all other tabs within ~1 second.

---

## 🐛 Troubleshooting

### Admin button not appearing?
**Solution:** Hard reload page
- Windows: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Action buttons not showing after enabling admin?
**Check localStorage:**
```javascript
// In browser console (F12)
localStorage.getItem('admin_unlocked')
// Should return: "true"
```

**Force enable if needed:**
```javascript
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

### Page won't load?
**Check dev server is running:**
```bash
cd frontend
npm run dev
```
Should show: `http://localhost:5173`

---

## 📚 Documentation

For detailed information, see:
- `ADMIN_MODE_FIX_P0.md` - Complete implementation guide
- `ADMIN_MODE_VISUAL_GUIDE.md` - Visual reference
- `ADMIN_MODE_FIX_SUMMARY.md` - Testing checklist

---

**That's it! Admin mode is now accessible without DevTools.** 🎉

**Next:** Navigate to `/console?admin=true` and start reviewing submissions!
