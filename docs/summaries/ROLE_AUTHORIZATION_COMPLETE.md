# Role-Based Authorization - Implementation Complete

## Summary

Implemented header-based role authorization for AutoComply AI backend with two roles: **admin** and **verifier**.

## ✅ Components Created

### 1. **backend/app/core/authz.py** - Authorization Module (118 lines)

**Core Functions:**
- `get_role(request)` - Extract role from `X-AutoComply-Role` header
- `require_admin(request)` - Raise 403 if not admin
- `can_reassign_case(request, current_assignee, new_assignee)` - Check reassignment permissions

**Role Definitions:**
```python
Role = Literal["admin", "verifier"]
```

### 2. **backend/app/core/__init__.py** - Module Exports

Exports authorization helpers for easy import:
```python
from app.core.authz import get_role, require_admin, can_reassign_case
```

### 3. **Updated backend/app/workflow/router.py** - Enforced Authorization

Added authorization to endpoints:
- Case update (reassignment check)
- Export endpoints (admin only)
- Bulk operations (admin only)
- Delete operations (admin only)
- Reset store (admin only)

### 4. **Updated backend/app/workflow/models.py** - Added Event Types

Added audit event types:
- `EXPORTED` - For export operations
- `COMMENT_ADDED` - For comments/notes

### 5. **backend/test_authz.py** - Test Suite (250 lines)

Comprehensive tests covering:
- Role extraction
- Admin enforcement
- Reassignment rules
- Real-world scenarios
- Header variations

## Authorization Rules

### Admin Role
**Full access to all operations:**
- ✅ Bulk assignment of cases
- ✅ Reassignment of cases to anyone
- ✅ Export cases (JSON/PDF)
- ✅ Delete cases
- ✅ Reset store (delete all data)
- ✅ All verifier permissions

### Verifier Role
**Case management with limitations:**
- ✅ Update case status
- ✅ Add notes and audit events
- ✅ Update packet selection
- ✅ View cases and audit timeline
- ✅ Self-assign unassigned cases
- ❌ Reassign cases to others (admin only)
- ❌ Export cases (admin only)
- ❌ Delete cases (admin only)
- ❌ Bulk operations (admin only)

## Header Format

### Request Header
```
X-AutoComply-Role: admin | verifier
```

**Default:** `verifier` if header is absent or invalid

**Case Insensitive:** "Admin", "ADMIN", "admin" all work

## Endpoint Authorization

### Public Endpoints (All Roles)
```http
GET  /workflow/health
GET  /workflow/cases
GET  /workflow/cases/{case_id}
GET  /workflow/cases/{case_id}/audit
POST /workflow/cases
POST /workflow/cases/{case_id}/audit
POST /workflow/cases/{case_id}/evidence/attach
PATCH /workflow/cases/{case_id}/evidence/packet
```

### Protected Endpoints (Conditional Access)
```http
PATCH /workflow/cases/{case_id}
# - All roles can update status, notes
# - Admin: Can reassign to anyone
# - Verifier: Can only self-assign from unassigned
```

### Admin-Only Endpoints
```http
# Export
GET  /workflow/cases/{case_id}/export/json
GET  /workflow/cases/{case_id}/export/pdf

# Bulk Operations
POST /workflow/cases/bulk/assign
POST /workflow/cases/bulk/status

# Delete/Reset
DELETE /workflow/cases/{case_id}
POST   /workflow/admin/reset-store
```

## Implementation Details

### Role Extraction
```python
from app.core.authz import get_role

@router.get("/some-endpoint")
def my_endpoint(request: Request):
    role = get_role(request)
    if role == "admin":
        # Admin-specific logic
    else:
        # Verifier logic
```

### Admin Requirement
```python
from app.core.authz import require_admin

@router.delete("/cases/{case_id}")
def delete_case(case_id: str, request: Request):
    require_admin(request)  # Raises 403 if not admin
    # Delete logic
```

### Reassignment Check
```python
from app.core.authz import can_reassign_case

@router.patch("/cases/{case_id}")
def update_case(case_id: str, updates: CaseUpdateInput, request: Request):
    case = get_case(case_id)
    
    if updates.assignedTo is not None:
        if not can_reassign_case(request, case.assignedTo, updates.assignedTo):
            raise HTTPException(403, detail="Admin required for reassignment")
    
    # Update logic
```

## Testing

### Run Test Suite
```bash
cd backend
.venv\Scripts\python test_authz.py
```

### Test Results
```
✅ ALL AUTHORIZATION TESTS PASSED!

Tested:
- Role extraction (5 tests)
- Admin enforcement (3 tests)
- Reassignment rules (7 tests)
- Real-world scenarios (6 scenarios)
- Header variations (6 edge cases)
```

### Example Test Scenarios

**Scenario 1: Verifier claims unassigned case**
```python
can_reassign_case(verifier_request, None, "verifier")  # ✅ True
```

**Scenario 2: Verifier tries to reassign to colleague**
```python
can_reassign_case(verifier_request, "verifier", "colleague")  # ❌ False
```

**Scenario 3: Admin reassigns to specialist**
```python
can_reassign_case(admin_request, "verifier", "specialist")  # ✅ True
```

**Scenario 4: Verifier tries to export**
```python
require_admin(verifier_request)  # ❌ Raises HTTPException 403
```

## API Examples

### Admin User - Full Access

**Export Case as JSON:**
```bash
curl -X GET http://localhost:8001/workflow/cases/{case_id}/export/json \
  -H "X-AutoComply-Role: admin"
```

**Bulk Assign Cases:**
```bash
curl -X POST http://localhost:8001/workflow/cases/bulk/assign \
  -H "X-AutoComply-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{
    "caseIds": ["case-1", "case-2", "case-3"],
    "assignedTo": "specialist@example.com"
  }'
```

**Delete Case:**
```bash
curl -X DELETE http://localhost:8001/workflow/cases/{case_id} \
  -H "X-AutoComply-Role: admin"
```

### Verifier User - Limited Access

**Self-Assign Unassigned Case:**
```bash
curl -X PATCH http://localhost:8001/workflow/cases/{case_id} \
  -H "X-AutoComply-Role: verifier" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedTo": "verifier"
  }'
```

**Update Case Status:**
```bash
curl -X PATCH http://localhost:8001/workflow/cases/{case_id} \
  -H "X-AutoComply-Role: verifier" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_review"
  }'
```

**Add Note:**
```bash
curl -X POST http://localhost:8001/workflow/cases/{case_id}/audit \
  -H "X-AutoComply-Role: verifier" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "comment_added",
    "actor": "verifier@example.com",
    "message": "Reviewed evidence, looks good",
    "meta": {"comment": "Evidence is sufficient"}
  }'
```

**Try to Export (Blocked):**
```bash
curl -X GET http://localhost:8001/workflow/cases/{case_id}/export/json \
  -H "X-AutoComply-Role: verifier"

# Response: 403 Forbidden
# {
#   "detail": "Admin role required for this operation"
# }
```

## Bulk Operations

### Bulk Assignment (Admin Only)
```http
POST /workflow/cases/bulk/assign
X-AutoComply-Role: admin
Content-Type: application/json

{
  "caseIds": ["case-1", "case-2", "case-3"],
  "assignedTo": "specialist@example.com"
}

Response:
{
  "total": 3,
  "success": 3,
  "failed": 0,
  "errors": []
}
```

### Bulk Status Update (Admin Only)
```http
POST /workflow/cases/bulk/status
X-AutoComply-Role: admin
Content-Type: application/json

{
  "caseIds": ["case-1", "case-2"],
  "status": "approved"
}

Response:
{
  "total": 2,
  "success": 2,
  "failed": 0,
  "errors": []
}
```

## Export Operations

### JSON Export (Admin Only)
```http
GET /workflow/cases/{case_id}/export/json
X-AutoComply-Role: admin

Response:
{
  "case": { /* Full CaseRecord */ },
  "auditTimeline": [ /* List of AuditEvents */ ],
  "exportedAt": "2026-01-07T10:30:00",
  "exportFormat": "json"
}
```

### PDF Export (Admin Only - Placeholder)
```http
GET /workflow/cases/{case_id}/export/pdf
X-AutoComply-Role: admin

Response:
{
  "message": "PDF export not yet implemented",
  "caseId": "550e8400-...",
  "exportFormat": "pdf",
  "placeholder": true
}
```

## Error Responses

### 403 Forbidden - Admin Required
```json
{
  "detail": "Admin role required for this operation"
}
```

### 403 Forbidden - Reassignment Not Allowed
```json
{
  "detail": "Admin role required to reassign cases. Verifiers can only self-assign from unassigned cases."
}
```

### 404 Not Found - Case Not Found
```json
{
  "detail": "Case not found: 550e8400-..."
}
```

## Audit Trail

All authorization-sensitive operations create audit events:

**Export:**
```python
AuditEvent(
  eventType="exported",
  actor="admin",
  message="Case exported as JSON",
  meta={"exportFormat": "json"}
)
```

**Bulk Assignment:**
```python
AuditEvent(
  eventType="assigned",
  actor="admin",
  message="Bulk assigned to specialist@example.com",
  meta={"bulkOperation": true}
)
```

**Bulk Status Update:**
```python
AuditEvent(
  eventType="status_changed",
  actor="admin",
  message="Bulk status change to approved",
  meta={"bulkOperation": true, "newStatus": "approved"}
)
```

## Security Considerations

### Current Implementation (Demo/Development)
- ✅ Header-based role separation
- ✅ Clear authorization boundaries
- ✅ Audit trail for all operations
- ⚠️ No authentication - anyone can set any role

### Production Recommendations
1. **Add Authentication:**
   - Use JWT tokens or session-based auth
   - Validate user identity before extracting role
   - Link role to authenticated user

2. **Store Roles in Database:**
   - User table with role column
   - Role-based access control (RBAC)
   - Role assignments auditable

3. **Enhanced Authorization:**
   - Permission-based access (not just roles)
   - Resource-level permissions (per-case access)
   - Team-based access (verifiers see only their team's cases)

4. **Replace Header with Token:**
   ```python
   def get_role(request: Request) -> Role:
       token = request.headers.get("Authorization")
       user = verify_jwt_token(token)  # Verify and decode
       return user.role  # From database, not header
   ```

## Future Enhancements

1. **Additional Roles:**
   - `reviewer` - Can approve/reject cases
   - `supervisor` - Can oversee teams
   - `readonly` - View-only access

2. **Granular Permissions:**
   - `can_export_pdf`
   - `can_delete_cases`
   - `can_bulk_assign`
   - `can_access_admin_panel`

3. **Team-Based Access:**
   - Verifiers see only their assigned cases
   - Supervisors see their team's cases
   - Admin sees all cases

4. **Resource Ownership:**
   - Users can update their own cases without admin
   - Users can add notes to cases they're assigned to
   - Users cannot modify cases assigned to others

## Files Modified

1. `backend/app/core/authz.py` - Created (118 lines)
2. `backend/app/core/__init__.py` - Created (11 lines)
3. `backend/app/workflow/router.py` - Updated (258 lines added)
4. `backend/app/workflow/models.py` - Updated (2 event types added)
5. `backend/test_authz.py` - Created (250 lines)

**Total Lines Added:** ~640 lines

---

**Status: ✅ COMPLETE**

Role-based authorization fully implemented with admin-only protection on bulk operations, exports, and deletes. Verifiers can manage cases but cannot reassign to others or perform admin operations.

**Test Results:** All 27 authorization tests pass ✅
