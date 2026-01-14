# Submission Edit/Delete Feature Implementation

## Overview
Implemented enterprise-safe submission modification and deletion capabilities with comprehensive business rules and audit trail preservation.

## Implementation Date
January 14, 2026

## Backend Changes

### 1. Database Schema Updates

**File**: `backend/app/submissions/schema.sql`

Added three new columns to the submissions table:
- `updated_at TEXT DEFAULT NULL` - Tracks last modification timestamp
- `is_deleted INTEGER DEFAULT 0 NOT NULL` - Soft delete flag (0=active, 1=deleted)
- `deleted_at TEXT DEFAULT NULL` - Tracks deletion timestamp

Added indexes for performance:
- `idx_submissions_updated_at`
- `idx_submissions_is_deleted`

**Migration**: Database was recreated with the new schema. Old database backed up to `backend/app/data/autocomply.db.backup`.

### 2. Pydantic Models

**File**: `backend/app/submissions/models.py`

**Updated `SubmissionRecord`**:
```python
class SubmissionRecord(BaseModel):
    # ... existing fields ...
    updatedAt: Optional[datetime] = Field(None)
    isDeleted: bool = Field(default=False)
    deletedAt: Optional[datetime] = Field(None)
```

**New `SubmissionUpdateInput`**:
```python
class SubmissionUpdateInput(BaseModel):
    decisionType: Optional[str] = None
    submittedBy: Optional[str] = None
    formData: Optional[Dict[str, Any]] = None
    rawPayload: Optional[Dict[str, Any]] = None
    evaluatorOutput: Optional[Dict[str, Any]] = None
```

**Updated `SubmissionListFilters`**:
```python
class SubmissionListFilters(BaseModel):
    # ... existing fields ...
    includeDeleted: bool = Field(default=False)
```

### 3. Repository Layer

**File**: `backend/app/submissions/repo.py`

**Updated `_row_to_submission()`**:
- Now parses `updated_at`, `is_deleted`, and `deleted_at` from database rows

**Updated `list_submissions()`**:
- Excludes deleted submissions by default (`WHERE is_deleted = 0`)
- Supports `includeDeleted` flag to show deleted submissions

**New `update_submission()`**:
```python
def update_submission(submission_id: str, input_data: SubmissionUpdateInput) -> Optional[SubmissionRecord]:
    """
    Updates submission with dynamic SET clause (only non-None fields updated).
    Sets updated_at automatically.
    Returns updated record.
    """
```

**New `soft_delete_submission()`**:
```python
def soft_delete_submission(submission_id: str) -> bool:
    """
    Soft delete submission (sets is_deleted=1, deleted_at=now).
    Returns success boolean.
    """
```

### 4. API Endpoints

**File**: `backend/app/submissions/router.py`

**Updated `GET /submissions`**:
- Added `includeDeleted: bool = False` query parameter
- Excludes deleted submissions by default

**New `PATCH /submissions/{submission_id}`**:
```python
@router.patch("/{submission_id}", response_model=SubmissionRecord)
def update_submission_endpoint(submission_id: str, input_data: SubmissionUpdateInput):
    """
    Update submission with business rule validation:
    - 404 if not found
    - 410 if deleted
    - 403 if case status prevents edit
    
    Editable statuses: new, in_review, needs_info
    """
```

**Business Rules**:
1. Submission must exist (404 Not Found)
2. Submission must not be deleted (410 Gone)
3. Linked case status must be 'new', 'in_review', or 'needs_info' (403 Forbidden)
4. Updates linked case `updated_at` timestamp
5. Sets submission `updated_at` automatically

**New `DELETE /submissions/{submission_id}`**:
```python
@router.delete("/{submission_id}", status_code=204)
def delete_submission_endpoint(submission_id: str):
    """
    Soft delete submission and cancel case:
    - 404 if not found
    - 204 if already deleted (idempotent)
    - 403 if case status != 'new' or case is assigned
    
    Sets: is_deleted=1, deleted_at=now, case.status='cancelled'
    """
```

**Business Rules**:
1. Submission must exist (404 Not Found)
2. Idempotent - returns 204 if already deleted
3. Linked case status must be 'new' (403 Forbidden)
4. Linked case must be unassigned (`assignedTo IS NULL`) (403 Forbidden)
5. Sets case status to 'cancelled'
6. Soft deletes submission (preserves audit trail)

### 5. Workflow Integration

**File**: `backend/app/workflow/repo.py`

**New `get_case_by_submission_id()`**:
```python
def get_case_by_submission_id(submission_id: str) -> Optional[CaseRecord]:
    """Retrieve case by submission_id foreign key"""
```

**Updated `list_cases()`**:
- Excludes cancelled cases by default (`WHERE status != 'cancelled'`)
- If explicitly filtering by status='cancelled', removes the exclusion

**File**: `backend/app/workflow/models.py`

**Updated `CaseStatus` enum**:
```python
class CaseStatus(str, Enum):
    # ... existing statuses ...
    CANCELLED = "cancelled"  # New status for deleted submissions
```

## Testing Results

### Test 1: Create Submission
```bash
POST /submissions
{
  "decisionType": "csf_practitioner",
  "submittedBy": "testuser@test.com",
  "formData": {"name": "Test Practitioner", "license": "12345"}
}
```

**Result**: ✅ SUCCESS
- Created with `updated_at: null`, `is_deleted: false`, `deleted_at: null`

### Test 2: Update Submission (PATCH)
```bash
PATCH /submissions/{id}
{
  "formData": {"name": "Updated Practitioner", "license": "54321"}
}
```

**Result**: ✅ SUCCESS
- Form data updated
- `updated_at` timestamp set automatically
- Original `created_at` preserved

### Test 3: Delete Submission (Soft Delete)
```bash
DELETE /submissions/{id}
```

**Result**: ✅ SUCCESS (204 No Content)
- Submission soft-deleted: `is_deleted=1`, `deleted_at` set
- Linked case status updated to 'cancelled'

### Test 4: List Submissions (Default)
```bash
GET /submissions
```

**Result**: ✅ SUCCESS
- Deleted submission excluded from list

### Test 5: List Submissions (Include Deleted)
```bash
GET /submissions?includeDeleted=true
```

**Result**: ✅ SUCCESS
- Deleted submission included in list
- Shows `is_deleted: true` and `deleted_at` timestamp

### Test 6: List Cases (Verifier Queue)
```bash
GET /workflow/cases
```

**Result**: ✅ SUCCESS
- Cancelled case excluded from verifier queue

## API Documentation

### PATCH /submissions/{submission_id}

**Request Body**:
```json
{
  "formData": {}, // Optional
  "decisionType": "string", // Optional
  "submittedBy": "string", // Optional
  "rawPayload": {}, // Optional
  "evaluatorOutput": {} // Optional
}
```

**Response**: `200 OK` - Updated SubmissionRecord

**Error Responses**:
- `404 Not Found` - Submission doesn't exist
- `410 Gone` - Submission has been deleted
- `403 Forbidden` - Case status prevents editing (not in [new, in_review, needs_info])

### DELETE /submissions/{submission_id}

**Response**: `204 No Content`

**Error Responses**:
- `404 Not Found` - Submission doesn't exist
- `403 Forbidden` - Case status is not 'new' OR case is assigned

## Business Rules Summary

### When can a submission be EDITED?
1. Submission must exist and not be deleted
2. Linked case status must be one of:
   - `new` - Not yet reviewed
   - `in_review` - Currently being reviewed
   - `needs_info` - Waiting for more information

**Cannot edit if case is**:
- `approved` - Final decision made
- `blocked` - Final decision made
- `closed` - Case completed
- `cancelled` - Submission deleted

### When can a submission be DELETED?
1. Submission must exist and not be deleted
2. Linked case status must be `new`
3. Case must be **unassigned** (`assigned_to IS NULL`)

**Cannot delete if**:
- Case has been assigned to a verifier
- Case is in any status other than 'new'

### What happens when a submission is deleted?
1. Submission is **soft-deleted** (not removed from database)
   - `is_deleted` set to 1
   - `deleted_at` set to current timestamp
2. Linked case status set to `cancelled`
3. Case disappears from verifier queue
4. Audit trail preserved for compliance

## Frontend Integration (Pending)

### Required Changes

1. **API Client** (`frontend/src/api/submissionsApi.ts`):
   ```typescript
   export async function updateSubmission(
     submissionId: string,
     data: { formData?: any; decisionType?: string }
   ): Promise<Submission> {
     const response = await fetch(`${API_BASE}/submissions/${submissionId}`, {
       method: 'PATCH',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(data),
     });
     if (!response.ok) throw new Error(await response.text());
     return response.json();
   }
   
   export async function deleteSubmission(submissionId: string): Promise<void> {
     const response = await fetch(`${API_BASE}/submissions/${submissionId}`, {
       method: 'DELETE',
     });
     if (!response.ok) throw new Error(await response.text());
   }
   ```

2. **My Submissions Page**:
   - Add Edit button (opens form prefilled with current data)
   - Add Delete button (shows confirmation modal)
   - Handle errors (show 403/410 messages to user)

3. **Verifier Consistency**:
   - Cancelled cases automatically excluded (backend handles this)
   - Optional: Add banner if viewing cancelled case directly

## Security Considerations

1. **Soft Delete**: Data never truly deleted, preserving audit trail
2. **Business Rules**: Prevent editing/deleting work in progress
3. **Assignment Check**: Users can't delete submissions assigned to verifiers
4. **Status Validation**: Strict status checks prevent invalid state transitions
5. **Timestamps**: Automatic tracking of all modifications

## Migration Path

If database already exists:
1. Backup existing database: `cp app/data/autocomply.db app/data/autocomply.db.backup`
2. Delete old database: `rm app/data/autocomply.db`
3. Start backend: Database will be recreated with new schema
4. Re-run seed scripts if needed

## Files Modified

### Backend
- `backend/app/submissions/schema.sql` - Added columns + indexes
- `backend/app/submissions/models.py` - Added fields + SubmissionUpdateInput
- `backend/app/submissions/repo.py` - Added update/soft_delete functions
- `backend/app/submissions/router.py` - Added PATCH/DELETE endpoints
- `backend/app/workflow/repo.py` - Added get_case_by_submission_id + list_cases filter
- `backend/app/workflow/models.py` - Added CANCELLED status

### Migration Files (Created)
- `backend/app/submissions/migration_add_edit_delete.sql` - SQL migration script
- `backend/scripts/migrate_add_edit_delete.py` - Python migration script (not needed since DB was recreated)

## Next Steps

1. **Frontend Implementation**:
   - Add Edit/Delete buttons to My Submissions list
   - Implement edit modal/form
   - Implement delete confirmation dialog
   - Add error handling for business rule violations

2. **Testing**:
   - E2E tests for edit workflow
   - E2E tests for delete workflow
   - Test business rule edge cases
   - Test cancelled case exclusion in verifier

3. **Documentation**:
   - Update API documentation
   - Add user guide for edit/delete feature
   - Document business rules for support team

## Success Criteria

✅ Backend schema updated with edit/delete columns  
✅ PATCH endpoint implemented with business rules  
✅ DELETE endpoint implemented with soft delete  
✅ Cancelled cases excluded from verifier queue  
✅ Audit trail preserved (soft delete)  
✅ All endpoints tested and working  
⏳ Frontend UI implementation (pending)  
⏳ Integration testing (pending)  

## Notes

- Database path is `backend/app/data/autocomply.db` (not `backend/data/autocomply.db`)
- `includeDeleted` parameter defaults to `false` for security
- DELETE is idempotent - returns 204 even if already deleted
- PATCH updates linked case `updated_at` timestamp for audit purposes
