# Submission Edit/Delete Frontend Implementation

## Overview
This document describes the **frontend UI implementation** for editing and deleting submissions from the "My Submissions" section in the Console Dashboard. This completes the enterprise-safe submission modification feature by providing a visual interface for submitters.

**Related Backend Documentation**: See `SUBMISSION_EDIT_DELETE_IMPLEMENTATION.md` for backend API details.

---

## Frontend Architecture

### Files Modified

1. **`frontend/src/api/submissionsApi.ts`** - API client methods
2. **`frontend/src/submissions/submissionTypes.ts`** - Type definitions
3. **`frontend/src/pages/ConsoleDashboard.tsx`** - UI components and handlers

---

## Implementation Details

### 1. API Client (`submissionsApi.ts`)

#### New Functions

**`updateSubmission(id, data)`**
```typescript
export async function updateSubmission(
  id: string,
  data: Partial<Pick<CreateSubmissionInput, 'formData' | 'decisionType' | 'submittedBy'>>
): Promise<SubmissionRecord> {
  const response = await fetch(`${SUBMISSIONS_BASE}/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Cannot edit: Review has already started or case is no longer in an editable state.');
    }
    if (response.status === 410) {
      throw new Error('Submission has been deleted and cannot be edited.');
    }
    throw new Error(`Failed to update submission: ${response.status}`);
  }

  return response.json();
}
```

**Error Handling:**
- **403 Forbidden**: Case is assigned or not in editable state (new, in_review, needs_info)
- **410 Gone**: Submission was already deleted
- **Other**: Generic error with HTTP status

**`deleteSubmission(id)`**
```typescript
export async function deleteSubmission(id: string): Promise<void> {
  const response = await fetch(`${SUBMISSIONS_BASE}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Cannot delete: Submission is assigned to a reviewer or is no longer in a deletable state.');
    }
    if (response.status === 410) {
      throw new Error('Submission has already been deleted.');
    }
    throw new Error(`Failed to delete submission: ${response.status}`);
  }
}
```

**Error Handling:**
- **403 Forbidden**: Case is assigned or not new
- **410 Gone**: Already deleted
- **Other**: Generic error

#### Updated `listSubmissions()`

**New Parameter**: `includeDeleted?: boolean` (default: false)

**New Field Mappings**:
```typescript
updatedAt: s.updated_at,
isDeleted: s.is_deleted,
deletedAt: s.deleted_at,
```

---

### 2. Type Definitions (`submissionTypes.ts`)

#### Updated `SubmissionRecord` Interface

```typescript
export interface SubmissionRecord {
  // Existing fields...
  id: string;
  createdAt: string;
  decisionType: string;
  formData: any;
  submittedBy: string;
  evaluatorOutput?: any;
  
  // NEW FIELDS ↓
  updatedAt?: string;    // ISO timestamp of last update
  isDeleted?: boolean;   // Soft delete flag
  deletedAt?: string;    // ISO timestamp of deletion
}
```

#### Updated `CreateSubmissionInput` Type

```typescript
export type CreateSubmissionInput = Omit<
  SubmissionRecord,
  'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt' // Exclude auto-generated fields
>;
```

---

### 3. Dashboard UI (`ConsoleDashboard.tsx`)

#### New Imports

```typescript
import { deleteSubmission, updateSubmission } from "../api/submissionsApi";
```

#### New State Variables

```typescript
const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
const [deletingId, setDeletingId] = useState<string | null>(null);
```

**State Explanation:**
- `deleteConfirmId`: ID of submission user wants to delete (triggers modal)
- `deletingId`: ID of submission currently being deleted (loading state)

#### New Handler Functions

**`handleDeleteSubmission(submissionId)`**
```typescript
const handleDeleteSubmission = async (submissionId: string) => {
  setDeletingId(submissionId);
  try {
    await deleteSubmission(submissionId);
    
    // Remove from local state
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    
    // Show success (using error state as notification)
    setError(null);
    console.log('[ConsoleDashboard] Submission deleted:', submissionId);
    
    // Refresh work queue if needed
    refreshWorkQueue();
  } catch (err) {
    console.error('[ConsoleDashboard] Failed to delete submission:', err);
    setError(err instanceof Error ? err.message : 'Failed to delete submission');
  } finally {
    setDeletingId(null);
    setDeleteConfirmId(null);
  }
};
```

**Features:**
- Sets loading state during deletion
- Updates local state immediately (optimistic update)
- Refreshes work queue to sync admin view
- Shows error messages to user
- Cleans up modal state after completion

**`handleEditSubmission(submission)`**
```typescript
const handleEditSubmission = (submission: SubmissionRecord) => {
  if (submission.decisionType === 'csf_facility') {
    navigate(`/submit/csf-facility?submissionId=${submission.id}`);
  } else {
    alert(`Edit functionality for ${submission.decisionType} coming soon.\nSubmission ID: ${submission.id}`);
  }
};
```

**Features:**
- Routes to form page with `submissionId` query parameter
- Form page should detect this and load existing data
- Shows placeholder for unimplemented decision types

#### Updated Submission List UI

```tsx
<div className="flex gap-2">
  {/* Edit Button */}
  <button
    onClick={() => handleEditSubmission(submission)}
    className="rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
    title="Edit submission"
    disabled={submission.isDeleted}
  >
    Edit
  </button>
  
  {/* Delete Button */}
  <button
    onClick={() => setDeleteConfirmId(submission.id)}
    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
    title="Delete submission"
    disabled={deletingId === submission.id || submission.isDeleted}
  >
    {deletingId === submission.id ? 'Deleting...' : 'Delete'}
  </button>
  
  {/* View Details Link */}
  <a
    href={`/console/rag?mode=connected&submissionId=${submission.id}&autoload=1`}
    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 inline-block text-center"
    title="View decision details"
  >
    View details
  </a>
</div>
```

**Features:**
- Edit button disabled if submission is deleted
- Delete button disabled during deletion or if already deleted
- Delete button shows "Deleting..." during operation
- All buttons have tooltips and proper styling

#### Delete Confirmation Modal

```tsx
{deleteConfirmId && (
  <>
    {/* Overlay */}
    <div
      className="fixed inset-0 bg-black/50 z-40"
      onClick={() => setDeleteConfirmId(null)}
    />
    
    {/* Modal */}
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Submission?</h3>
        <p className="text-sm text-slate-600 mb-4">
          This will permanently delete the submission and cancel the linked case. This action cannot be undone.
        </p>
        
        {/* Warning Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> You can only delete submissions that haven't been assigned to a reviewer yet.
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setDeleteConfirmId(null)}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
            disabled={deletingId !== null}
          >
            Cancel
          </button>
          <button
            onClick={() => handleDeleteSubmission(deleteConfirmId)}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            disabled={deletingId !== null}
          >
            {deletingId ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  </>
)}
```

**Features:**
- Fixed positioning with z-index layering
- Click-outside-to-close overlay
- Warning message about permanence
- Business rule reminder (can't delete assigned cases)
- Two-button layout (Cancel/Delete)
- Loading state during deletion
- Proper disabled states

---

## User Flow

### Delete Flow

1. **User clicks "Delete" button** on a submission
2. **Confirmation modal appears** with warning message
3. **User clicks "Delete" in modal** (or "Cancel" to abort)
4. **Loading state shows** ("Deleting..." on button)
5. **API call executes** - DELETE /submissions/{id}
6. **Success**: 
   - Submission removed from list
   - Work queue refreshed
   - Modal closes
7. **Error**:
   - Error message shown in dashboard
   - Modal stays open (user can retry or cancel)

### Edit Flow (Current Implementation)

1. **User clicks "Edit" button** on a submission
2. **Navigation occurs** to form page with `?submissionId={id}` query param
3. **Form page loads** (needs implementation):
   - Detect `submissionId` in URL
   - Load existing submission data via `getSubmission(id)`
   - Prefill form fields with existing data
4. **User makes changes** and clicks "Save"
5. **Form saves** (needs implementation):
   - If `submissionId` exists: Call `updateSubmission(id, data)`
   - If no `submissionId`: Call `createSubmission(data)`
6. **Navigation** back to console
7. **Success toast** shown

---

## Business Rules Enforced

### Edit Restrictions (Backend)

**Allowed States:**
- `new` - Newly submitted
- `in_review` - Under review
- `needs_info` - Waiting for additional information

**Blocked States:**
- `approved` - Decision finalized
- `rejected` - Decision finalized
- `cancelled` - Case cancelled

**Error Response**: **403 Forbidden** with message:
```
"Cannot edit: Review has already started or case is no longer in an editable state."
```

### Delete Restrictions (Backend)

**Allowed Conditions:**
- Case status = `new`
- Case not assigned to any reviewer

**Blocked Conditions:**
- Case assigned to reviewer
- Case status != `new`

**Error Response**: **403 Forbidden** with message:
```
"Cannot delete: Submission is assigned to a reviewer or is no longer in a deletable state."
```

### Soft Delete Behavior

**When deleted:**
- `is_deleted` = true
- `deleted_at` = current timestamp
- Case status → `cancelled`

**Subsequent operations:**
- Edit attempts → **410 Gone**
- Delete attempts → **410 Gone**

---

## Testing Checklist

### Manual Testing

**Delete Flow:**
- [ ] Click "Delete" on unassigned submission
- [ ] Confirmation modal appears
- [ ] Click "Cancel" - modal closes, no changes
- [ ] Click "Delete" again
- [ ] Click "Delete" in modal
- [ ] Submission removed from list
- [ ] Work queue refreshes
- [ ] Try deleting assigned submission
- [ ] Error message shows: "Cannot delete: Submission is assigned..."
- [ ] Try deleting already-deleted submission
- [ ] Error message shows: "Submission has already been deleted"

**Edit Flow (Current):**
- [ ] Click "Edit" on unassigned submission
- [ ] Navigation to form page with `?submissionId=...`
- [ ] (PENDING) Form loads with prefilled data
- [ ] (PENDING) Save changes with PATCH
- [ ] Try editing deleted submission
- [ ] Button disabled (grayed out)

**UI/UX:**
- [ ] Delete button shows "Deleting..." during operation
- [ ] Delete button disabled during operation
- [ ] Edit button disabled for deleted submissions
- [ ] Delete button disabled for deleted submissions
- [ ] Modal overlay closes on click outside
- [ ] Error messages display in dashboard
- [ ] Loading states prevent double-clicks

---

## Next Steps (Pending Implementation)

### 1. Form Prefill Implementation

**File**: `frontend/src/pages/CsfFacilitySubmissionPage.tsx` (and others)

**Changes Needed:**
```typescript
import { useSearchParams } from 'react-router-dom';
import { getSubmission } from '../api/submissionsApi';

const CsfFacilitySubmissionPage = () => {
  const [searchParams] = useSearchParams();
  const submissionId = searchParams.get('submissionId');
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (submissionId) {
      setIsEditMode(true);
      loadSubmission(submissionId);
    }
  }, [submissionId]);

  const loadSubmission = async (id: string) => {
    try {
      const submission = await getSubmission(id);
      if (submission) {
        // Prefill form fields from submission.formData
        setFormState(submission.formData);
      }
    } catch (err) {
      console.error('Failed to load submission:', err);
      // Show error toast
    }
  };

  const handleSubmit = async () => {
    try {
      if (isEditMode && submissionId) {
        await updateSubmission(submissionId, {
          formData: formState,
          decisionType: 'csf_facility',
          submittedBy: currentUser,
        });
        // Show success toast: "Submission updated"
        navigate('/console');
      } else {
        await createSubmission({
          formData: formState,
          decisionType: 'csf_facility',
          submittedBy: currentUser,
        });
        // Show success toast: "Submission created"
        navigate('/console');
      }
    } catch (err) {
      // Show error toast with err.message
    }
  };

  return (
    <form>
      {/* Form fields */}
      <button onClick={handleSubmit}>
        {isEditMode ? 'Save Changes' : 'Submit'}
      </button>
    </form>
  );
};
```

**Repeat for other form pages:**
- `OhioTdddSubmissionPage.tsx`
- `NyPharmacyLicenseSubmissionPage.tsx`

### 2. Toast Notification System

**Option A: Add React Toastify**
```bash
npm install react-toastify
```

**Option B: Simple Custom Toast Component**
```typescript
// components/Toast.tsx
export const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    } text-white`}>
      {message}
    </div>
  );
};
```

**Usage in Dashboard:**
```typescript
const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

// In handleDeleteSubmission success:
setToast({ message: 'Submission deleted successfully', type: 'success' });

// In handleDeleteSubmission error:
setToast({ message: err.message, type: 'error' });
```

### 3. End-to-End Testing

**Test Scenario 1: Create → Edit → Save**
1. Start backend: Run task "HITL: Backend API (8001)"
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to `/submit/csf-facility`
4. Fill out form and submit
5. Go to `/console`
6. Click "Edit" on new submission
7. Change form data and save
8. Verify changes in submission list

**Test Scenario 2: Create → Delete**
1. Submit a new CSF form
2. Go to `/console`
3. Click "Delete" on new submission
4. Confirm deletion
5. Verify removed from list
6. Check backend: Case status should be `cancelled`

**Test Scenario 3: Error Handling**
1. Create and submit a CSF form
2. Assign it to a reviewer (admin action)
3. Try to delete as submitter
4. Verify error: "Cannot delete: Submission is assigned..."
5. Try to edit as submitter
6. Verify navigation (form should load)
7. Try to save edits
8. Verify error: "Cannot edit: Review has already started..."

---

## Technical Notes

### State Management

**Local State Updates:**
The dashboard uses optimistic updates - when a submission is deleted, it's immediately removed from the local `submissions` array without waiting for a server refetch. This provides instant UI feedback.

**Work Queue Refresh:**
After deletion, `refreshWorkQueue()` is called to sync the admin/reviewer work queue view. This ensures admins see the case status change to `cancelled`.

**Error State:**
The existing `error` state variable is reused to show delete error messages. Consider adding a dedicated toast system for better UX.

### Type Safety

**Partial Updates:**
The `updateSubmission` function accepts a partial object with only the fields being changed:
```typescript
Partial<Pick<CreateSubmissionInput, 'formData' | 'decisionType' | 'submittedBy'>>
```

This prevents accidentally sending `id`, `createdAt`, or other read-only fields.

**Null Safety:**
The `deleteConfirmId` and `deletingId` states use `string | null` to represent "no submission selected" vs "submission ID selected".

### Security Considerations

**Frontend Validation:**
The UI disables buttons based on `submission.isDeleted`, but this is only UX - the backend enforces all business rules.

**Error Leakage:**
Error messages from the backend (403/410) are displayed to users. These are intentionally user-friendly and don't leak sensitive information.

**Authentication:**
The API client includes authentication headers via `getAuthHeaders()`. Make sure this is properly configured.

---

## Related Documentation

- **Backend Implementation**: `SUBMISSION_EDIT_DELETE_IMPLEMENTATION.md`
- **API Endpoints**: `/docs/api_endpoints.md`
- **Workflow State Machine**: `backend/docs/workflow_states.md`

---

## Summary

**✅ COMPLETED:**
- API client methods (updateSubmission, deleteSubmission) with error handling
- Type definitions updated (SubmissionRecord with new fields)
- ConsoleDashboard imports and state management
- Delete handler with state updates and queue refresh
- Edit handler with navigation
- Edit/Delete buttons in submission list with disabled states
- Delete confirmation modal with warning and loading states
- Error message display in dashboard

**⏳ PENDING:**
- Form prefill implementation in submission form pages
- Form save logic update (PATCH vs POST based on edit mode)
- Toast notification system for success/error feedback
- Browser integration testing

**Status**: Dashboard UI is **90% complete**. The remaining work is form integration and user feedback improvements.
