# Admin Mode Quick Reference - Visual Guide

## 🎯 Three Ways to Enable Admin Mode

### 1️⃣ URL Query Parameter (EASIEST - RECOMMENDED)

**URL**: `http://localhost:5173/console?admin=true`

**What happens:**
1. Page loads
2. Admin mode auto-enabled
3. URL cleans to `/console`
4. Badge and buttons appear

**When to use:** 
- First time setup
- Sharing with team members
- Bookmarking for quick access

---

### 2️⃣ UI Toggle Button (NO DEVTOOLS)

**Location:** Console page header, top-right

**Steps:**
1. Navigate to `/console`
2. Look for button: "Enable Admin" (gray)
3. Click button
4. Page reloads
5. Button changes to "Disable Admin" (amber)
6. Badge appears

**When to use:**
- When you're already on console page
- Quick toggle on/off
- Don't want to edit URL

---

### 3️⃣ Browser DevTools (FALLBACK)

**Steps:**
1. Press F12 (open DevTools)
2. Go to Console tab
3. Paste: `localStorage.setItem('admin_unlocked', 'true')`
4. Press Enter (allow pasting if prompted)
5. Reload page: `location.reload()`

**When to use:**
- URL and button methods not working
- Debugging issues
- Advanced troubleshooting

---

## 📊 Visual Indicators

### ADMIN MODE ENABLED ✅

**Console Header:**
```
┌────────────────────────────────────────────────────────────┐
│ AutoComply AI – Compliance Console                         │
│ Explore how AutoComply AI evaluates...                     │
│                                                             │
│  [🛡️ Admin Mode]  [Disable Admin]  │  AI/RAG debug [⚪]     │
└────────────────────────────────────────────────────────────┘
         ↑                  ↑                         ↑
    Amber badge      Amber button            RAG toggle
```

**Work Queue Header:**
```
Filter:  [All (10)]  [Submitted (5)]  [In Review (2)]  [Approved (2)]  [Rejected (1)]
           ↑           ↑ blue          ↑ purple        ↑ green        ↑ red
      Dark gray    Active filters show count with color coding
```

**Submission Row (status: submitted):**
```
┌────────────────────────────────────────────────────────────┐
│ Status: [submitted]  Decision: [ok_to_ship]                │
│ Title: Practitioner CSF - Dr. Smith                        │
│ Type: practitioner_csf                                     │
│ Created: 12/26/2024                                        │
│                                                             │
│ Actions: [Start Review]  [Notes]                           │
│            ↑ purple      ↑ gray                             │
└────────────────────────────────────────────────────────────┘
```

**Submission Row (status: in_review):**
```
┌────────────────────────────────────────────────────────────┐
│ Status: [in_review]  Decision: [ok_to_ship]                │
│ Title: Practitioner CSF - Dr. Jones                        │
│ Type: practitioner_csf                                     │
│ Created: 12/26/2024                                        │
│                                                             │
│ Actions: [Approve]  [Reject]  [Notes]                      │
│            ↑ green   ↑ red    ↑ gray                       │
└────────────────────────────────────────────────────────────┘
```

**Notes Modal (Editable):**
```
┌─────────────────────────────────────────┐
│ Reviewer Notes                          │
│ Practitioner CSF - Dr. Smith            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Verified DEA license AP1234567 is   │ │
│ │ active in CA. Checking attestation  │ │
│ │ acceptance...                        │ │
│ │ [Cursor here - editable]            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│         [Cancel]  [Save Notes]          │
│                      ↑ blue             │
└─────────────────────────────────────────┘
```

---

### ADMIN MODE DISABLED ⚠️

**Console Header:**
```
┌────────────────────────────────────────────────────────────┐
│ AutoComply AI – Compliance Console                         │
│ Explore how AutoComply AI evaluates...                     │
│                                                             │
│                        [Enable Admin]  │  AI/RAG debug [⚪] │
└────────────────────────────────────────────────────────────┘
                              ↑
                         Gray button
                       (no badge shown)
```

**Work Queue Header:**
```
Filter:  [All (10)]  [Submitted (5)]  [In Review (2)]  [Approved (2)]  [Rejected (1)]
                                                           
⚠️ Read-only (Admin unlock required) ← Warning badge shown
```

**Submission Row (any status):**
```
┌────────────────────────────────────────────────────────────┐
│ Status: [submitted]  Decision: [ok_to_ship]                │
│ Title: Practitioner CSF - Dr. Smith                        │
│ Type: practitioner_csf                                     │
│ Created: 12/26/2024                                        │
│                                                             │
│ Actions: Admin access required                             │
│            ↑ gray italic text (no buttons)                 │
└────────────────────────────────────────────────────────────┘
```

**Notes Modal (Read-Only):**
```
┌─────────────────────────────────────────┐
│ View Reviewer Notes                     │
│ Practitioner CSF - Dr. Smith            │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Verified DEA license AP1234567 is   │ │
│ │ active in CA. Attestation accepted. │ │
│ │ [Disabled - cannot edit]            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ⚠️ Admin access required to edit notes  │
│                                         │
│                            [Close]      │
└─────────────────────────────────────────┘
```

---

## 🎨 Color Coding Reference

### Status Colors (Reviewer Workflow)
- **Submitted**: Blue `bg-blue-600`
- **In Review**: Purple `bg-purple-600`
- **Approved**: Green `bg-green-600`
- **Rejected**: Red `bg-red-600`

### Decision Colors (AI Engine)
- **ok_to_ship**: Green `bg-green-600`
- **blocked**: Red `bg-red-600`
- **needs_review**: Yellow `bg-yellow-600`

### Admin UI Colors
- **Admin Badge**: Amber `bg-amber-50` `border-amber-300` `text-amber-800`
- **Enable Button**: Gray `bg-slate-700` `text-white`
- **Disable Button**: Amber `bg-amber-100` `text-amber-800`
- **Warning Badge**: Amber `bg-amber-50` `text-amber-700`

---

## 🔄 State Transitions

### Enable Admin Mode
```
[Disabled State]
      ↓ Click "Enable Admin" OR navigate to ?admin=true
localStorage.setItem('admin_unlocked', 'true')
      ↓ Page reload (automatic)
[Enabled State]
  - Badge appears
  - Button text: "Disable Admin"
  - Button color: Amber
  - Action buttons visible
```

### Disable Admin Mode
```
[Enabled State]
      ↓ Click "Disable Admin"
localStorage.removeItem('admin_unlocked')
      ↓ Page reload (automatic)
[Disabled State]
  - Badge disappears
  - Button text: "Enable Admin"
  - Button color: Gray
  - Action buttons hidden
```

---

## 📝 Button Labels & Actions

### Admin Toggle Button

| State | Label | Color | Click Action |
|-------|-------|-------|--------------|
| Disabled | "Enable Admin" | Gray | Enable admin → reload |
| Enabled | "Disable Admin" | Amber | Disable admin → reload |

### Work Queue Action Buttons (Admin Only)

| Button | Status | Color | Action |
|--------|--------|-------|--------|
| Start Review | submitted | Purple | submitted → in_review |
| Approve | in_review | Green | in_review → approved |
| Reject | in_review | Red | in_review → rejected |
| Notes | any | Gray | Open notes modal |
| View Notes | any (non-admin) | Gray | Open read-only modal |

### Filter Chips

| Filter | Color (Active) | Color (Inactive) | Shows |
|--------|----------------|------------------|-------|
| All | Dark gray | Light gray | All submissions |
| Submitted | Blue | Light blue | status=submitted |
| In Review | Purple | Light purple | status=in_review |
| Approved | Green | Light green | status=approved |
| Rejected | Red | Light red | status=rejected |

---

## 🚀 Quick Actions Cheat Sheet

### To Enable Admin Mode
```
Option 1: http://localhost:5173/console?admin=true
Option 2: Click "Enable Admin" button
Option 3: DevTools → localStorage.setItem('admin_unlocked', 'true')
```

### To Disable Admin Mode
```
Option 1: Click "Disable Admin" button
Option 2: DevTools → localStorage.removeItem('admin_unlocked')
```

### To Review a Submission (Admin)
```
1. Filter to "Submitted" (optional)
2. Click "Start Review" → status: in_review
3. Click "Notes" → Add review comments
4. Click "Approve" or "Reject" → status: approved/rejected
```

### To Check Admin Status
```javascript
// Browser console
localStorage.getItem('admin_unlocked') === 'true'
```

---

## ⚡ Keyboard Shortcuts (Future Enhancement)

Not yet implemented, but recommended additions:

- `Alt+A` - Toggle admin mode
- `Alt+R` - Start review on selected item
- `Alt+Y` - Approve (yes)
- `Alt+N` - Reject (no)
- `Alt+M` - Open notes modal

---

## 📱 Mobile/Responsive Behavior

- Admin badge: Stacks below title on small screens
- Toggle button: Full width on mobile
- Filter chips: Horizontal scroll on mobile
- Action buttons: Stack vertically on small screens
- Notes modal: Full screen on mobile

---

## 🔍 Accessibility (a11y)

- Admin badge: `role="status"` `aria-live="polite"`
- Toggle button: `aria-pressed={isAdmin}` `title` attribute
- Action buttons: `disabled={updating}` with visual feedback
- Filter chips: `aria-label` with counts
- Notes modal: `role="dialog"` `aria-modal="true"`

---

**Last Updated**: 2024-12-26  
**Status**: ✅ Production Ready  
**Build**: ✅ Success
