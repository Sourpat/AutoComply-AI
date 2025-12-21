# Applying Practitioner CSF Improvements to Other Sandboxes

This guide shows how to apply the same UX patterns from the Practitioner CSF Sandbox to other CSF sandboxes (Facility, EMS, etc.).

## 🎯 Reusable Patterns

### 1. High-Contrast Test Banner

Replace any low-contrast test coverage notes with this pattern:

```tsx
<div className="mt-1 rounded-md bg-emerald-50 px-3 py-1.5 border border-emerald-200">
  <div className="flex items-center gap-2">
    <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="text-[11px] font-medium text-emerald-800">
      Backed by automated tests
    </span>
    <span className="text-[10px] font-mono text-emerald-700">
      backend/tests/test_csf_[VERTICAL]_api.py
    </span>
  </div>
</div>
```

**What it does:**
- Light green background with dark green text (WCAG AA contrast)
- Check icon for visual confirmation
- Displays test file path in monospace
- Consistent across all sandboxes

### 2. Scenario Pill Highlighting

Update scenario button styles to use blue highlighting:

```tsx
{SCENARIOS.map((scenario) => {
  const isActive = scenario.id === selectedScenarioId;
  return (
    <button
      key={scenario.id}
      type="button"
      onClick={() => applyScenario(scenario)}
      className={[
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium transition",
        isActive
          ? "border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-200"
          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50",
      ].join(" ")}
    >
      <span>{scenario.label}</span>
    </button>
  );
})}
```

**Add scenario description box:**

```tsx
{selectedScenarioId && (
  <div className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-[11px] text-blue-900 border border-blue-200">
    <strong className="font-semibold">Scenario: </strong>
    {SCENARIOS.find((s) => s.id === selectedScenarioId)?.description}
  </div>
)}
```

**What it does:**
- Blue ring + background for selected pill (consistent with Hospital sandbox)
- Gray for unselected pills
- Hover effect for better UX
- Readable scenario description below pills

### 3. Copilot Staleness Tracking

Add these state variables:

```tsx
const [lastCopilotPayload, setLastCopilotPayload] = useState<string | null>(null);

const getCurrentCopilotPayloadString = () => {
  return JSON.stringify({
    form: buildPayload(form),
    controlledSubstances,
  });
};

const copilotIsStale =
  copilotResponse !== null &&
  lastCopilotPayload !== null &&
  lastCopilotPayload !== getCurrentCopilotPayloadString();
```

**Clear copilot state when inputs change:**

```tsx
// In onChange handler
const onChange = (field, value) => {
  setForm((prev) => ({ ...prev, [field]: value }));
  if (copilotResponse !== null) {
    setCopilotResponse(null);
    setCopilotError(null);
    setLastCopilotPayload(null);
  }
};

// In scenario change handler
function applyScenario(scenario) {
  // ... set form fields
  setCopilotResponse(null);
  setCopilotError(null);
  setLastCopilotPayload(null);
}

// In controlled substances panel onChange
<ControlledSubstancesPanel
  onChange={(newSubstances) => {
    setControlledSubstances(newSubstances);
    if (copilotResponse !== null) {
      setCopilotResponse(null);
      setCopilotError(null);
      setLastCopilotPayload(null);
    }
  }}
/>
```

**Store payload after successful copilot run:**

```tsx
const runFormCopilot = async () => {
  // ... API call
  setCopilotResponse(result);
  setLastCopilotPayload(getCurrentCopilotPayloadString());
};
```

**Add staleness warning banner:**

```tsx
{copilotIsStale && (
  <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2">
    <span className="text-amber-600 mt-0.5">⚠️</span>
    <p className="text-[11px] text-amber-800">
      Form has changed since last copilot analysis. Click "Check & Explain" for updated guidance.
    </p>
  </div>
)}
```

**What it does:**
- Prevents stale results from confusing users
- Auto-clears copilot when form/scenario/substances change
- Shows clear warning if results are outdated
- Ensures data freshness

### 4. Submission Flow (Optional)

If the sandbox needs user submission capability:

**Backend endpoint** (add to route file):

```python
from datetime import datetime
import uuid

# Module-level in-memory store
SUBMISSION_STORE: dict = {}

class SubmissionResponse(BaseModel):
    submission_id: str
    status: str
    created_at: str
    decision_status: Optional[str] = None
    reason: Optional[str] = None

@router.post("/submit", response_model=SubmissionResponse)
async def submit_csf(form: CsfForm) -> SubmissionResponse:
    decision = evaluate_csf(form)
    submission_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat() + "Z"
    
    SUBMISSION_STORE[submission_id] = {
        "submission_id": submission_id,
        "form": form.model_dump(),
        "decision": decision.model_dump(),
        "status": "submitted",
        "created_at": created_at,
    }
    
    return SubmissionResponse(
        submission_id=submission_id,
        status="submitted",
        created_at=created_at,
        decision_status=decision.status,
        reason=decision.reason,
    )
```

**Frontend state and handler:**

```tsx
const [submissionId, setSubmissionId] = useState<string | null>(null);
const [submissionLoading, setSubmissionLoading] = useState(false);
const [submissionError, setSubmissionError] = useState<string | null>(null);

const handleSubmit = async () => {
  setSubmissionLoading(true);
  setSubmissionError(null);
  
  try {
    const resp = await fetch(`${API_BASE}/csf/[vertical]/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(form)),
    });
    
    if (!resp.ok) throw new Error(`Submission failed: ${resp.status}`);
    
    const result = await resp.json();
    setSubmissionId(result.submission_id);
  } catch (err: any) {
    setSubmissionError(err?.message ?? "Submission failed");
  } finally {
    setSubmissionLoading(false);
  }
};
```

**Frontend UI:**

```tsx
<button
  onClick={handleSubmit}
  disabled={submissionLoading}
  className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
>
  {submissionLoading ? "Submitting…" : "Submit for verification"}
</button>

{submissionId && (
  <div className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
    <div className="flex items-start gap-2">
      <svg className="h-4 w-4 text-emerald-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="text-[11px] font-semibold text-emerald-800">Submitted successfully</p>
        <p className="text-[10px] text-emerald-700 mt-1">
          Submission ID: <span className="font-mono">{submissionId}</span>
        </p>
      </div>
    </div>
  </div>
)}
```

### 5. Controlled Substances Placeholder

Update the search input placeholder:

```tsx
<input
  placeholder="Try: Hydrocodone, NDC 00093-3102-01, DEA Schedule II"
  // ... other props
/>
```

**What it does:**
- Gives users concrete examples
- Reduces confusion about what to search for
- Improves first-time user experience

## 📋 Checklist for Applying to Facility Sandbox

Use this checklist when updating the Facility CSF Sandbox:

- [ ] Update test banner to emerald style with check icon
- [ ] Change scenario pills to blue highlighting (selected) and gray (unselected)
- [ ] Add scenario description box below pills
- [ ] Add `lastCopilotPayload` state
- [ ] Add `getCurrentCopilotPayloadString()` helper
- [ ] Add `copilotIsStale` computed value
- [ ] Clear copilot state in `onChange` handler
- [ ] Clear copilot state in scenario selection
- [ ] Wrap `ControlledSubstancesPanel` onChange to clear copilot
- [ ] Store payload after successful copilot run
- [ ] Add staleness warning banner in copilot UI
- [ ] Update controlled substances search placeholder
- [ ] (Optional) Add submission endpoint and UI
- [ ] Verify all backend tests pass
- [ ] Verify UI behavior matches Hospital/Practitioner sandboxes

## 🎨 Color Palette Reference

For consistency across all sandboxes:

| Element | Colors | Usage |
|---------|--------|-------|
| Test banner | `bg-emerald-50`, `text-emerald-800`, `border-emerald-200` | Success indicator |
| Selected scenario | `bg-blue-50`, `text-blue-900`, `ring-blue-200`, `border-blue-500` | Active state |
| Unselected scenario | `bg-white`, `text-gray-700`, `border-gray-300` | Inactive state |
| Staleness warning | `bg-amber-50`, `text-amber-800`, `border-amber-200` | Warning state |
| Submission success | `bg-emerald-50`, `text-emerald-800`, `border-emerald-200` | Success confirmation |
| Error messages | `bg-red-50`, `text-red-700`, `border-red-200` | Error state |

## 🚀 Benefits

By applying these patterns consistently:

1. **User Experience**: Clear visual feedback, no stale data
2. **Developer Experience**: Reusable components, less debugging
3. **Quality**: High test coverage, consistent behavior
4. **Maintainability**: Same patterns across all sandboxes
5. **Accessibility**: High-contrast colors, clear labels

## 📝 Notes

- Always test thoroughly after applying changes
- Keep color schemes consistent across sandboxes
- Document any sandbox-specific customizations
- Update verification docs for each sandbox

---

**Quick Copy-Paste Templates**: All code snippets above can be directly copied and adapted to your target sandbox with minimal changes (just update vertical-specific names like `practitioner` → `facility`).
