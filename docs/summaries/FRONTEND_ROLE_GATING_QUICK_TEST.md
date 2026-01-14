# Frontend Role Gating - Quick Test Guide

## Quick Verification

### 1. **Test Role Headers in DevTools**

**Enable Admin Mode:**
```javascript
// Browser console
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

**Check API Headers:**
1. Open DevTools → Network tab
2. Navigate to `/console/workspace`
3. Click any case to open details
4. Find request to `/workflow/cases/{id}`
5. Check **Request Headers:**
   ```
   X-AutoComply-Role: admin ✓
   ```

**Switch to Verifier:**
```javascript
// Browser console
localStorage.removeItem('admin_unlocked');
location.reload();
```

**Check API Headers Again:**
1. Navigate to `/console/workspace`
2. Click any case
3. Find request to `/workflow/cases/{id}`
4. Check **Request Headers:**
   ```
   X-AutoComply-Role: verifier ✓
   ```

---

### 2. **Test UI Controls**

#### **As Admin** (admin_unlocked=true)

1. Go to Compliance Console: http://localhost:5173/console
2. Click "Enable Admin" button (if not already enabled)
3. Navigate to Case Workspace
4. Open any case from the list
5. **Verify Assign Button:**
   - ✅ Button is **enabled** (white background)
   - ✅ Click opens dropdown with users
   - ✅ Can select "Unassigned" or any user
6. **Verify Export Packet Button:**
   - ✅ Button is **enabled** (white background)
   - ✅ Click downloads `decision_packet_*.json`

#### **As Verifier** (admin_unlocked=false)

1. Go to Compliance Console: http://localhost:5173/console
2. Click "Disable Admin" button (if currently enabled)
3. Navigate to Case Workspace
4. Open any case from the list
5. **Verify Assign Button:**
   - ❌ Button is **disabled** (gray background)
   - ❌ Click does nothing
   - ✅ Hover shows tooltip: "Admin access required"
6. **Verify Export Packet Button:**
   - ❌ Button is **disabled** (gray background)
   - ❌ Click does nothing
   - ✅ Hover shows tooltip: "Admin access required"

---

### 3. **Test Backend Authorization**

**Start Backend:**
```powershell
cd backend
.venv\Scripts\python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
```

**Test Admin Export (Should Work):**
```bash
# Get a case ID from the UI first
curl -X GET http://localhost:8001/workflow/cases/{CASE_ID}/export/json \
  -H "X-AutoComply-Role: admin"

# Expected: 200 OK with JSON bundle
```

**Test Verifier Export (Should Fail):**
```bash
curl -X GET http://localhost:8001/workflow/cases/{CASE_ID}/export/json \
  -H "X-AutoComply-Role: verifier"

# Expected: 403 Forbidden
# {"detail": "Admin role required for this operation"}
```

---

## Expected Behavior Summary

| Action | Admin | Verifier |
|--------|-------|----------|
| **API Headers** | `X-AutoComply-Role: admin` | `X-AutoComply-Role: verifier` |
| **Assign Button** | ✅ Enabled, clickable | ❌ Disabled, tooltip |
| **Export Button** | ✅ Enabled, downloads | ❌ Disabled, tooltip |
| **Backend Export** | ✅ 200 OK | ❌ 403 Forbidden |
| **Backend Reassign** | ✅ 200 OK | ❌ 403 Forbidden |

---

## Visual Indicators

### **Admin Mode Enabled**
```
┌─────────────────────────────────────┐
│ [👤 Assign]  [📦 Export Packet]    │ ← White buttons (enabled)
└─────────────────────────────────────┘
```

### **Verifier Mode (Default)**
```
┌─────────────────────────────────────┐
│ [👤 Assign]  [📦 Export Packet]    │ ← Gray buttons (disabled)
│      ↑              ↑                │
│      │              └─ Hover: "Admin access required"
│      └─ Hover: "Admin access required"
└─────────────────────────────────────┘
```

---

## Troubleshooting

### **Issue: Buttons still enabled as verifier**

**Fix:**
```javascript
// Clear cache and reload
localStorage.clear();
location.reload();
```

### **Issue: No role header in requests**

**Check:**
1. Open DevTools → Sources
2. Find `authHeaders.ts`
3. Set breakpoint in `getCurrentRole()`
4. Trigger API call
5. Verify `localStorage.getItem('admin_unlocked')` value

### **Issue: Backend returns 403 even as admin**

**Check:**
```javascript
// Verify admin mode is actually enabled
console.log(localStorage.getItem('admin_unlocked')); // Should be 'true'
```

**Re-enable:**
```javascript
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

---

## Quick Commands

**Enable Admin Mode:**
```javascript
localStorage.setItem('admin_unlocked', 'true'); location.reload();
```

**Disable Admin Mode:**
```javascript
localStorage.removeItem('admin_unlocked'); location.reload();
```

**Check Current Role:**
```javascript
console.log(localStorage.getItem('admin_unlocked') === 'true' ? 'admin' : 'verifier');
```

---

**All tests passing = ✅ Implementation working correctly!**
