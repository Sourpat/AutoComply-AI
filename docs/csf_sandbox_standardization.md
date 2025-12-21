# CSF Sandbox Standardization

## Overview
Standardized all CSF sandbox forms to use shared infrastructure for evaluate/submit operations, ensuring reliable state management and consistent UX across all forms.

## Changes Implemented

### 1. Created Shared Infrastructure

#### `frontend/src/hooks/useCsfActions.ts`
Custom React hook for CSF evaluate/submit operations:
- **Type Safety**: `CsfType` union type for compile-time validation
- **Functions**: 
  - `evaluate(payload)`: POST to `/csf/{csfType}/evaluate`
  - `submit(payload)`: POST to `/csf/{csfType}/submit`
  - `reset()`: Clear all state
- **State Exposed**: 
  - `isEvaluating`, `isSubmitting` (loading states)
  - `decision` (evaluation result)
  - `error` (user-friendly error messages)
  - `submissionId`, `traceId` (submission result)
- **Reliability**: Uses try/catch/finally to guarantee state cleanup
- **Error Handling**: console.error for debugging + user-friendly error state

#### `frontend/src/components/SubmitForVerificationBar.tsx`
Reusable submit UI component:
- **Props**: `disabled`, `isSubmitting`, `onSubmit`, `submissionId`, `error`
- **Features**:
  - Button states: "Submit for verification" → "Submitting..." → "Already submitted"
  - Success message with submission ID (emerald background)
  - Error display (red background)
  - "View in Console →" button navigates to `/console?submission_id={id}`
- **Accessibility**: Proper disabled states with readable colors
- **Dark Mode**: Full support with `dark:` variants

### 2. Updated All 5 CSF Sandboxes

All sandboxes now use the shared infrastructure:

#### ✅ PractitionerCsfSandbox.tsx
- Added `useCsfActions("practitioner")` hook
- Replaced custom submit logic with `csfActions.submit()`
- Replaced custom submit UI with `SubmitForVerificationBar`
- Fixed helper text visibility (text-slate-600 dark:text-slate-300)

#### ✅ HospitalCsfSandbox.tsx
- Added `useCsfActions("hospital")` hook
- **NEW**: Added "Submit for verification" CTA (was missing entirely)
- Replaced custom submit UI with `SubmitForVerificationBar`
- Added `handleSubmitForVerification` function

#### ✅ FacilityCsfSandbox.tsx
- Added `useCsfActions("facility")` hook
- Replaced custom submit logic with `csfActions.submit()`
- Replaced custom submit UI with `SubmitForVerificationBar`
- Fixed helper text visibility

#### ✅ EmsCsfSandbox.tsx
- Added `useCsfActions("ems")` hook
- Replaced custom submit logic with `csfActions.submit()`
- Replaced custom submit UI with `SubmitForVerificationBar`

#### ✅ ResearcherCsfSandbox.tsx
- Added `useCsfActions("researcher")` hook
- Replaced custom submit logic with `csfActions.submit()`
- Replaced custom submit UI with `SubmitForVerificationBar`

## Benefits

### 1. Reliability
- **No More Stuck Spinners**: try/catch/finally guarantees loading state cleanup
- **Consistent Error Handling**: All forms handle errors the same way
- **Predictable Behavior**: Same logic path for all CSF types

### 2. Maintainability
- **Single Source of Truth**: One hook for all evaluate/submit logic
- **DRY Principle**: Eliminated ~200 lines of duplicate code across 5 files
- **Easy Updates**: Change hook once, affects all sandboxes

### 3. User Experience
- **Consistent UI**: All forms have identical submit flow
- **"View in Console" Button**: Quick navigation from sandbox to verification queue
- **Readable Helper Text**: Fixed visibility issues (was invisible in some themes)
- **Hospital Sandbox Complete**: Now has submit CTA like all other forms

## Testing Checklist

- [ ] PractitionerCsfSandbox: Evaluate works, Submit works, spinner clears
- [ ] HospitalCsfSandbox: Evaluate works, Submit works (new!), spinner clears
- [ ] FacilityCsfSandbox: Evaluate works, Submit works, spinner clears
- [ ] EmsCsfSandbox: Evaluate works, Submit works, spinner clears
- [ ] ResearcherCsfSandbox: Evaluate works, Submit works, spinner clears
- [ ] "View in Console" navigates to /console?submission_id={id}
- [ ] Helper text readable in light mode
- [ ] Helper text readable in dark mode
- [ ] Error messages display properly
- [ ] Success messages display with submission ID

## Technical Details

### Endpoints Used
All sandboxes use these endpoint patterns:
- `POST /csf/{type}/evaluate` - Returns decision
- `POST /csf/{type}/submit` - Returns {submission_id, trace_id, status}

### State Management Pattern
Before (manual):
```typescript
const [submissionId, setSubmissionId] = useState(null);
const [submissionLoading, setSubmissionLoading] = useState(false);
const [submissionError, setSubmissionError] = useState(null);

// Manual try/catch/finally in each component
```

After (hook):
```typescript
const csfActions = useCsfActions("practitioner");
// Access: csfActions.submissionId, csfActions.isSubmitting, csfActions.error
// Call: await csfActions.submit(payload);
```

### UI Pattern
Before (custom buttons):
```tsx
<button onClick={handleSubmit} disabled={submissionLoading}>
  {submissionLoading ? "Submitting..." : "Submit"}
</button>
{submissionError && <div>{submissionError}</div>}
{submissionId && <div>Success: {submissionId}</div>}
```

After (shared component):
```tsx
<SubmitForVerificationBar
  disabled={!API_BASE}
  isSubmitting={csfActions.isSubmitting}
  onSubmit={handleSubmitForVerification}
  submissionId={csfActions.submissionId}
  error={csfActions.error}
/>
```

## Files Changed
- ✅ `frontend/src/hooks/useCsfActions.ts` (created)
- ✅ `frontend/src/components/SubmitForVerificationBar.tsx` (created)
- ✅ `frontend/src/components/PractitionerCsfSandbox.tsx` (updated)
- ✅ `frontend/src/components/HospitalCsfSandbox.tsx` (updated)
- ✅ `frontend/src/components/FacilityCsfSandbox.tsx` (updated)
- ✅ `frontend/src/components/EmsCsfSandbox.tsx` (updated)
- ✅ `frontend/src/components/ResearcherCsfSandbox.tsx` (updated)

**All files: 0 TypeScript errors**
