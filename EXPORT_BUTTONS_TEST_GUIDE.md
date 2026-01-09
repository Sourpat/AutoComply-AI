# Export Buttons - Quick Test Guide

## Location

Export buttons are in **Case Details Panel** → **Attachments Tab**

## Buttons Added

### 1. **Export JSON**
- Blue button with download icon
- Downloads case bundle as JSON
- Endpoint: `GET /workflow/cases/{caseId}/export/json`

### 2. **Export PDF** 
- Red button with document icon
- Downloads case packet as PDF
- Endpoint: `GET /workflow/cases/{caseId}/export/pdf`

---

## Access Control

| Role | API Mode | Button State | Behavior |
|------|----------|--------------|----------|
| **Admin** | ✅ Available | ✅ Enabled (colored) | Click downloads file |
| **Admin** | ❌ Demo Mode | ❌ Disabled (gray) | Tooltip: "Export available in API mode" |
| **Verifier** | ✅ Available | ❌ Disabled (gray) | Tooltip: "Admin access required" |
| **Verifier** | ❌ Demo Mode | ❌ Disabled (gray) | Tooltip: "Admin access required" |

---

## Quick Test Steps

### **1. Test as Admin in API Mode** ✅

**Setup:**
```javascript
// Browser console
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

**Verify Backend Running:**
```powershell
# Check backend is running on port 8001
netstat -ano | Select-String ":8001"
```

**Test:**
1. Navigate to http://localhost:5173/console/workspace
2. Click any case to open details
3. Click **Attachments** tab
4. **Verify Export Section:**
   - ✅ "Export Case Packet" header visible
   - ✅ "Export JSON" button is **blue** (enabled)
   - ✅ "Export PDF" button is **red** (enabled)
5. **Click "Export JSON":**
   - ✅ Button text changes to "Exporting..."
   - ✅ File downloads: `case_{id}_export.json`
   - ✅ JSON contains: case, submission, evidence, timeline, metadata
6. **Click "Export PDF":**
   - ✅ Button text changes to "Exporting..."
   - ✅ File downloads: `case_{id}_packet.pdf`
   - ✅ PDF opens with formatted case data

---

### **2. Test as Verifier in API Mode** ❌

**Setup:**
```javascript
// Browser console
localStorage.removeItem('admin_unlocked');
location.reload();
```

**Test:**
1. Navigate to http://localhost:5173/console/workspace
2. Click any case
3. Click **Attachments** tab
4. **Verify Export Section:**
   - ✅ "Export JSON" button is **gray** (disabled)
   - ✅ "Export PDF" button is **gray** (disabled)
5. **Hover over disabled buttons:**
   - ✅ Tooltip shows: "Admin access required"
6. **Click disabled buttons:**
   - ✅ Nothing happens (no download, no error)

---

### **3. Test in Demo/localStorage Mode** ❌

**Stop Backend:**
```powershell
# Stop backend server
Get-NetTCPConnection -LocalPort 8001 | 
  Select-Object -ExpandProperty OwningProcess | 
  ForEach-Object { Stop-Process -Id $_ -Force }
```

**Test (as Admin):**
```javascript
// Ensure admin mode
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

1. Navigate to http://localhost:5173/console/workspace
2. Click any case
3. Click **Attachments** tab
4. **Verify Export Section:**
   - ✅ Both buttons are **gray** (disabled)
5. **Hover over disabled buttons:**
   - ✅ Tooltip shows: "Export available in API mode"
6. **Click disabled buttons:**
   - ✅ Nothing happens (blocked by API mode check)

---

## Visual States

### **Admin + API Mode (Enabled)**
```
┌─────────────────────────────────────────────┐
│ Export Case Packet                          │
│                                             │
│  [⬇ Export JSON]  [📄 Export PDF]          │
│   (Blue/Active)     (Red/Active)            │
└─────────────────────────────────────────────┘
```

### **Verifier OR Demo Mode (Disabled)**
```
┌─────────────────────────────────────────────┐
│ Export Case Packet                          │
│                                             │
│  [⬇ Export JSON]  [📄 Export PDF]          │
│   (Gray/Disabled)  (Gray/Disabled)          │
│       ↑                  ↑                  │
│       └─ Hover: Shows tooltip               │
└─────────────────────────────────────────────┘
```

---

## API Endpoint Test

**Manual cURL Test:**

```bash
# Export JSON (as admin)
curl -X GET http://localhost:8001/workflow/cases/{CASE_ID}/export/json \
  -H "X-AutoComply-Role: admin" \
  -o case_export.json

# Expected: 200 OK with JSON bundle

# Export PDF (as admin)
curl -X GET http://localhost:8001/workflow/cases/{CASE_ID}/export/pdf \
  -H "X-AutoComply-Role: admin" \
  -o case_packet.pdf

# Expected: 200 OK with PDF file

# Try as verifier (should fail)
curl -X GET http://localhost:8001/workflow/cases/{CASE_ID}/export/json \
  -H "X-AutoComply-Role: verifier"

# Expected: 403 Forbidden
# {"detail": "Admin role required for this operation"}
```

---

## Troubleshooting

### **Issue: Buttons always disabled even as admin**

**Fix:**
```javascript
// Check API mode detection
console.log('Admin:', localStorage.getItem('admin_unlocked') === 'true');

// Manually check backend
fetch('http://localhost:8001/workflow/health')
  .then(r => r.json())
  .then(d => console.log('Backend healthy:', d.ok));
```

### **Issue: Export returns 403 Forbidden**

**Check:**
1. Verify admin mode enabled: `localStorage.getItem('admin_unlocked')`
2. Open DevTools → Network tab
3. Check request headers include: `X-AutoComply-Role: admin`

**Fix:**
```javascript
localStorage.setItem('admin_unlocked', 'true');
location.reload();
```

### **Issue: Export returns 404 Not Found**

**Verify:**
- Backend is running on port 8001
- Case ID exists in database
- Endpoints are registered in backend router

**Check:**
```bash
# Test health endpoint
curl http://localhost:8001/workflow/health

# Should return: {"ok": true}
```

---

## Expected File Outputs

### **JSON Export (`case_{id}_export.json`)**
```json
{
  "case": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "CSF - Dr. Jane Smith",
    "status": "in_review",
    "evidence": [...],
    "packetEvidenceIds": [...]
  },
  "submission": {
    "id": "sub-123",
    "formData": {...},
    "evaluatorOutput": {...}
  },
  "auditTimeline": [...],
  "evidence": [...],
  "packetEvidence": [...],
  "metadata": {
    "exportedAt": "2026-01-07T12:00:00Z",
    "exportFormat": "bundle",
    "caseId": "550e8400-...",
    "version": "1.0"
  }
}
```

### **PDF Export (`case_{id}_packet.pdf`)**
- Cover Page with case metadata
- Submission Summary
- Decision Summary
- Evidence Packet
- Audit Timeline
- Professional formatting with reportlab

---

## Success Criteria

- [x] Export buttons visible in Attachments tab
- [x] Buttons enabled only for admin in API mode
- [x] Verifiers see "Admin access required" tooltip
- [x] Demo mode shows "Export available in API mode" tooltip
- [x] Export JSON downloads valid JSON file
- [x] Export PDF downloads valid PDF file
- [x] Backend enforces admin-only access (403 for verifiers)
- [x] Loading states show "Exporting..." text
- [x] Error handling alerts user on failure
- [x] Files download with correct names

---

**All checks passing = ✅ Export functionality working!**
