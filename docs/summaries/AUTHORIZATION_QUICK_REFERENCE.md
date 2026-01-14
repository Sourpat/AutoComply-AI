# Authorization Quick Reference

## Adding Authorization to New Endpoints

### 1. Import Authorization Helpers
```python
from fastapi import Request
from app.core.authz import get_role, require_admin, can_reassign_case
```

### 2. Add Request Parameter to Endpoint
```python
@router.post("/my-endpoint")
def my_endpoint(data: MyInput, request: Request):  # Add request: Request
    # Your logic here
```

### 3. Enforce Authorization

**Option A: Require Admin Role**
```python
@router.delete("/cases/{case_id}")
def delete_case(case_id: str, request: Request):
    require_admin(request)  # Raises 403 if not admin
    # Delete logic
```

**Option B: Check Role Conditionally**
```python
@router.get("/cases")
def list_cases(request: Request):
    role = get_role(request)
    
    if role == "admin":
        # Return all cases
        return get_all_cases()
    else:
        # Return only assigned cases for verifiers
        return get_assigned_cases("verifier")
```

**Option C: Custom Authorization Logic**
```python
@router.patch("/cases/{case_id}")
def update_case(case_id: str, updates: CaseUpdateInput, request: Request):
    case = get_case(case_id)
    
    # Check reassignment permission
    if updates.assignedTo is not None:
        if not can_reassign_case(request, case.assignedTo, updates.assignedTo):
            raise HTTPException(403, detail="Admin required for reassignment")
    
    # Update logic
```

## Authorization Patterns

### Pattern 1: Admin-Only Endpoint
```python
@router.post("/admin/dangerous-operation")
def dangerous_operation(request: Request):
    require_admin(request)
    # Only admins reach this point
    return perform_dangerous_operation()
```

### Pattern 2: Role-Based Data Filtering
```python
@router.get("/cases")
def list_cases(status: str, request: Request):
    role = get_role(request)
    
    if role == "admin":
        # Admins see all cases
        filters = CaseListFilters(status=status)
    else:
        # Verifiers see only their assigned cases
        filters = CaseListFilters(status=status, assignedTo="verifier")
    
    return list_cases(filters)
```

### Pattern 3: Permission-Based Access
```python
@router.patch("/cases/{case_id}")
def update_case(case_id: str, updates: CaseUpdateInput, request: Request):
    role = get_role(request)
    
    # Admins can do anything
    if role == "admin":
        return update_case_impl(case_id, updates)
    
    # Verifiers have restrictions
    if updates.assignedTo is not None:
        raise HTTPException(403, detail="Verifiers cannot reassign cases")
    
    if updates.status in [CaseStatus.APPROVED, CaseStatus.BLOCKED]:
        raise HTTPException(403, detail="Verifiers cannot approve/block cases")
    
    # Allowed updates for verifiers
    return update_case_impl(case_id, updates)
```

## Common Use Cases

### Export Endpoint (Admin Only)
```python
@router.get("/cases/{case_id}/export/json")
def export_case_json(case_id: str, request: Request):
    require_admin(request)
    
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, detail="Case not found")
    
    # Create audit event
    add_audit_event(AuditEventCreateInput(
        caseId=case_id,
        eventType=AuditEventType.EXPORTED,
        actor="admin",
        message="Case exported as JSON"
    ))
    
    return case.model_dump()
```

### Bulk Operation (Admin Only)
```python
@router.post("/cases/bulk/assign")
def bulk_assign(input_data: BulkAssignInput, request: Request):
    require_admin(request)
    
    results = {"success": 0, "failed": 0}
    
    for case_id in input_data.caseIds:
        try:
            update_case(case_id, CaseUpdateInput(assignedTo=input_data.assignedTo))
            results["success"] += 1
        except Exception as e:
            results["failed"] += 1
    
    return results
```

### Self-Assignment (Verifier Allowed)
```python
@router.post("/cases/{case_id}/claim")
def claim_case(case_id: str, request: Request):
    case = get_case(case_id)
    if not case:
        raise HTTPException(404, detail="Case not found")
    
    # Check if already assigned
    if case.assignedTo is not None:
        raise HTTPException(400, detail="Case already assigned")
    
    # Self-assign (verifier allowed)
    role = get_role(request)
    assignee = "verifier" if role == "verifier" else "admin"
    
    return update_case(case_id, CaseUpdateInput(assignedTo=assignee))
```

## Testing Authorization

### Test with curl

**Admin Request:**
```bash
curl -X POST http://localhost:8001/workflow/cases/bulk/assign \
  -H "X-AutoComply-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{"caseIds": ["case-1"], "assignedTo": "user@example.com"}'
```

**Verifier Request:**
```bash
curl -X POST http://localhost:8001/workflow/cases/bulk/assign \
  -H "X-AutoComply-Role: verifier" \
  -H "Content-Type: application/json" \
  -d '{"caseIds": ["case-1"], "assignedTo": "user@example.com"}'

# Expected: 403 Forbidden
```

**No Header (Defaults to Verifier):**
```bash
curl -X POST http://localhost:8001/workflow/cases/bulk/assign \
  -H "Content-Type: application/json" \
  -d '{"caseIds": ["case-1"], "assignedTo": "user@example.com"}'

# Expected: 403 Forbidden (defaults to verifier)
```

### Test with Python
```python
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

# Admin request
response = client.post(
    "/workflow/cases/bulk/assign",
    headers={"X-AutoComply-Role": "admin"},
    json={"caseIds": ["case-1"], "assignedTo": "user@example.com"}
)
assert response.status_code == 200

# Verifier request (should fail)
response = client.post(
    "/workflow/cases/bulk/assign",
    headers={"X-AutoComply-Role": "verifier"},
    json={"caseIds": ["case-1"], "assignedTo": "user@example.com"}
)
assert response.status_code == 403
```

## Error Handling

### 403 Forbidden Response
```python
@router.delete("/cases/{case_id}")
def delete_case(case_id: str, request: Request):
    require_admin(request)  # Raises HTTPException
    # ...

# If not admin, FastAPI automatically returns:
{
  "detail": "Admin role required for this operation"
}
```

### Custom Error Messages
```python
@router.patch("/cases/{case_id}")
def update_case(case_id: str, updates: CaseUpdateInput, request: Request):
    if not can_reassign_case(request, current, new):
        raise HTTPException(
            status_code=403,
            detail="Verifiers can only self-assign from unassigned cases"
        )
```

## Best Practices

1. **Always add `request: Request` parameter** to endpoints that need authorization
2. **Call `require_admin(request)` first** in admin-only endpoints
3. **Use `get_role(request)` for conditional logic** instead of hardcoding checks
4. **Create audit events** for sensitive operations (exports, deletes, bulk ops)
5. **Return clear error messages** explaining why access was denied
6. **Test both roles** when adding new authorization logic

## Checklist for New Endpoints

- [ ] Import `Request` from `fastapi`
- [ ] Import authorization helpers from `app.core.authz`
- [ ] Add `request: Request` parameter to endpoint function
- [ ] Enforce authorization (require_admin or custom check)
- [ ] Add audit event for sensitive operations
- [ ] Test with both admin and verifier roles
- [ ] Update API documentation with authorization requirements

## Frontend Integration

### Setting Role Header in Frontend

**JavaScript/TypeScript:**
```typescript
// In API client
const role = localStorage.getItem('userRole') || 'verifier';

fetch('/workflow/cases/bulk/assign', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-AutoComply-Role': role,  // Send role header
  },
  body: JSON.stringify({ caseIds, assignedTo })
});
```

**React Example:**
```typescript
// In workflowApi.ts
export const bulkAssignCases = async (
  caseIds: string[], 
  assignedTo: string,
  role: 'admin' | 'verifier' = 'verifier'
) => {
  const response = await fetch(`${API_BASE}/workflow/cases/bulk/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AutoComply-Role': role,
    },
    body: JSON.stringify({ caseIds, assignedTo }),
  });
  
  if (response.status === 403) {
    throw new Error('Admin role required for bulk operations');
  }
  
  return response.json();
};
```

---

**Quick Reference Card:**

```
┌──────────────────────────────────────────────────────────┐
│ Authorization Quick Reference                            │
├──────────────────────────────────────────────────────────┤
│ Header:     X-AutoComply-Role: admin | verifier          │
│ Default:    verifier                                     │
├──────────────────────────────────────────────────────────┤
│ Import:     from app.core.authz import get_role,        │
│               require_admin, can_reassign_case           │
├──────────────────────────────────────────────────────────┤
│ Admin Only: require_admin(request)                       │
│ Get Role:   role = get_role(request)                     │
│ Reassign:   can_reassign_case(req, current, new)        │
├──────────────────────────────────────────────────────────┤
│ Admin:      Full access                                 │
│ Verifier:   Limited (no reassign/export/delete/bulk)    │
└──────────────────────────────────────────────────────────┘
```
