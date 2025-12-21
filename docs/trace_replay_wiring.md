# Trace Replay Wiring Documentation

## Overview

The Compliance Console uses a **trace selection system** where each work queue item, recent decision, and other compliance event can open a unique trace replay drawer showing the full execution timeline.

## Architecture

### Key Components

1. **TraceReplayDrawer** (`frontend/src/components/TraceReplayDrawer.tsx`)
   - Reusable drawer component for displaying trace execution timelines
   - Accepts `TraceData` object with trace ID, status, risk, and execution steps
   - Features: expandable step details, JSON copy buttons, color-coded status badges

2. **ConsoleDashboard** (`frontend/src/pages/ConsoleDashboard.tsx`)
   - Main compliance console page
   - Manages trace selection state
   - Contains work queue items, recent decisions, and other compliance widgets

### Data Structure

#### TraceData Interface
```typescript
interface TraceData {
  trace_id: string;              // Unique identifier (e.g., "trace-2025-12-19-08-30-00-abc123")
  tenant: string;                // Tenant/facility identifier
  created_at: string;            // ISO timestamp
  final_status: "ok_to_ship" | "blocked" | "needs_review";
  risk_level: "Low" | "Medium" | "High";
  scenario: string;              // Human-readable scenario description
  csf_type: "Practitioner" | "Hospital" | "Researcher" | "Facility" | "EMS";
  total_duration_ms: number;     // Total execution time in milliseconds
  steps: TraceStep[];            // Array of execution steps (see below)
}
```

#### TraceStep Interface
```typescript
interface TraceStep {
  id: string;                    // Unique step identifier
  timestamp: string;             // HH:MM:SS.mmm format
  label: string;                 // Human-readable step description
  type: "engine" | "rag" | "decision" | "api";
  status: "success" | "warning" | "error";
  duration_ms?: number;          // Step duration (optional)
  details?: {                    // Optional detailed information
    endpoint?: string;           // API endpoint
    engine?: string;             // Engine name/version
    query?: string;              // RAG query text
    result?: string;             // Result description
    payload?: Record<string, unknown>;   // Request payload
    response?: Record<string, unknown>;  // Response data
  };
}
```

### State Management

The trace selection uses two state variables:

```typescript
const [isTraceOpen, setIsTraceOpen] = useState(false);
const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
```

**Flow:**
1. User clicks "Open trace" button → `handleViewTrace(traceId)` is called
2. `setSelectedTraceId(traceId)` stores the trace ID
3. `setIsTraceOpen(true)` opens the drawer
4. Component looks up `TRACE_REPLAYS[selectedTraceId]` to get full trace data
5. TraceReplayDrawer renders with the resolved trace data
6. User closes drawer → `handleCloseTrace()` resets both states

### Trace Registry (TRACE_REPLAYS)

All available traces are stored in a `Record<string, TraceData>` mapping:

```typescript
const TRACE_REPLAYS: Record<string, TraceData> = {
  "trace-2025-12-19-08-30-00-abc123": { /* TraceData */ },
  "trace-2025-12-21-14-20-00-def456": { /* TraceData */ },
  "trace-2025-12-21-11-15-00-ghi789": { /* TraceData */ },
};
```

**Key Design Decision:** We use a dictionary lookup instead of passing full `TraceData` objects around. This:
- ✅ Keeps state management lightweight (just trace IDs)
- ✅ Makes it easy to add new traces without changing component signatures
- ✅ Allows future backend integration (replace dictionary with API fetch)
- ✅ Prevents prop drilling of large trace objects

### Work Queue Items

Work queue items link to traces via `trace_id`:

```typescript
interface WorkQueueItem {
  id: string;                    // Work queue item ID (e.g., "WQ-001")
  trace_id: string;              // Links to TRACE_REPLAYS key
  facility: string;              // Facility/account name
  reason: string;                // Why it's flagged
  age: string;                   // How long ago it was flagged
  priority: "High" | "Medium" | "Low";
  priorityColor: string;         // Tailwind text color class
}
```

## How to Add a New Trace

### Step 1: Create TraceData Object

Add a new entry to `TRACE_REPLAYS` in `ConsoleDashboard.tsx`:

```typescript
const TRACE_REPLAYS: Record<string, TraceData> = {
  // ... existing traces ...
  "trace-2025-12-22-16-45-00-jkl012": {
    trace_id: "trace-2025-12-22-16-45-00-jkl012",
    tenant: "facility-west-wing",
    created_at: "2025-12-22 16:45:33",
    final_status: "blocked",
    risk_level: "High",
    scenario: "Facility CSF – Invalid DEA registration",
    csf_type: "Facility",
    total_duration_ms: 189,
    steps: [
      {
        id: "step-1",
        timestamp: "16:45:33.012",
        label: "Facility CSF evaluation initiated",
        type: "api",
        status: "success",
        duration_ms: 7,
        details: {
          endpoint: "POST /api/csf/facility/evaluate",
          payload: { facility_id: "FAC-WEST-001", dea_number: "XY9876543" },
        },
      },
      {
        id: "step-2",
        timestamp: "16:45:33.089",
        label: "DEA validation failed",
        type: "engine",
        status: "error",
        duration_ms: 134,
        details: {
          engine: "DEA Validator v4.1",
          result: "DEA number XY9876543 not found in registry",
        },
      },
      {
        id: "step-3",
        timestamp: "16:45:33.201",
        label: "Final decision: blocked",
        type: "decision",
        status: "error",
        duration_ms: 48,
        details: {
          response: {
            decision: "blocked",
            risk: "High",
            dea_invalid: true,
            reasons: ["DEA registration not found", "Cannot ship without valid DEA"],
          },
        },
      },
    ],
  },
};
```

### Step 2: Create Work Queue Item (if applicable)

Add a new item to `WORK_QUEUE_ITEMS`:

```typescript
const WORK_QUEUE_ITEMS: WorkQueueItem[] = [
  // ... existing items ...
  {
    id: "WQ-004",
    trace_id: "trace-2025-12-22-16-45-00-jkl012",
    facility: "Facility West Wing",
    reason: "Invalid DEA registration detected",
    age: "Flagged 30 minutes ago",
    priority: "High",
    priorityColor: "text-amber-700",
  },
];
```

### Step 3: Wire Button (if not using work queue)

If adding trace replay to a custom component, use:

```typescript
<button onClick={() => handleViewTrace("trace-2025-12-22-16-45-00-jkl012")}>
  Open trace
</button>
```

## Color Coding Guide

### Status Colors
- **ok_to_ship**: `bg-emerald-100 text-emerald-700` (green)
- **blocked**: `bg-red-100 text-red-700` (red)
- **needs_review**: `bg-amber-100 text-amber-700` (amber/yellow)

### Risk Colors
- **Low**: `bg-emerald-100 text-emerald-700` (green)
- **Medium**: `bg-amber-100 text-amber-700` (amber/yellow)
- **High**: `bg-red-100 text-red-700` (red)

### Step Status
- **success**: `bg-emerald-500` with ✓ icon
- **warning**: `bg-amber-500` with ⚠ icon
- **error**: `bg-red-500` with ✕ icon

### Priority Colors
- **High**: `text-amber-700`
- **Medium**: `text-slate-600`
- **Low**: `text-slate-600`

## Trace ID Naming Convention

Use the format: `trace-YYYY-MM-DD-HH-MM-SS-{random}`

Example: `trace-2025-12-22-16-45-00-jkl012`

**Components:**
- `trace-`: Prefix for easy identification
- `YYYY-MM-DD`: Date
- `HH-MM-SS`: Time (24-hour format)
- `{random}`: 6-character alphanumeric suffix for uniqueness

## Validation Checklist

When adding a new trace, verify:

- [ ] `trace_id` is unique (no duplicates in `TRACE_REPLAYS`)
- [ ] `trace_id` follows naming convention
- [ ] `final_status` is one of: `"ok_to_ship"`, `"blocked"`, `"needs_review"`
- [ ] `risk_level` is one of: `"Low"`, `"Medium"`, `"High"`
- [ ] `csf_type` is one of: `"Practitioner"`, `"Hospital"`, `"Researcher"`, `"Facility"`, `"EMS"`
- [ ] Each `step.type` is one of: `"engine"`, `"rag"`, `"decision"`, `"api"`
- [ ] Each `step.status` is one of: `"success"`, `"warning"`, `"error"`
- [ ] `steps` array has at least 1 step
- [ ] Final step has `type: "decision"`
- [ ] `created_at` timestamp is reasonable and matches trace_id date
- [ ] If creating work queue item, `trace_id` matches an entry in `TRACE_REPLAYS`

## Future Enhancements

### Backend Integration (Recommended)

Replace the static `TRACE_REPLAYS` dictionary with API calls:

```typescript
const handleViewTrace = async (traceId: string) => {
  setIsTraceOpen(true);
  setSelectedTraceId(traceId);
  
  try {
    const response = await fetch(`/api/traces/${traceId}`);
    const traceData = await response.json();
    setSelectedTrace(traceData);
  } catch (error) {
    console.error('Failed to load trace:', error);
    // Show error state in drawer
  }
};
```

**Benefits:**
- No need to preload all traces
- Real-time trace data from backend
- Supports filtering, search, pagination
- Reduces frontend bundle size

### Empty State Handling

Add a fallback for missing traces:

```typescript
const selectedTrace = selectedTraceId ? TRACE_REPLAYS[selectedTraceId] : null;

// In TraceReplayDrawer component:
if (!trace) {
  return (
    <div className="p-6 text-center">
      <p className="text-slate-600">Trace not found. Try another item.</p>
    </div>
  );
}
```

### Keyboard Navigation

Add ESC key support:

```typescript
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isTraceOpen) {
      handleCloseTrace();
    }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [isTraceOpen]);
```

## Testing Scenarios

### Manual Testing
1. **Work Queue Item 1** → Should show Ohio Hospital TDDD renewal trace (needs_review, High risk)
2. **Work Queue Item 2** → Should show NY Pharmacy DEA expiring trace (needs_review, Medium risk)
3. **Work Queue Item 3** → Should show Researcher Schedule I trace (blocked, Medium risk)
4. **Header "View trace replay"** → Should show Work Queue Item 1 trace
5. **Recent Decisions "Open trace"** → Should show Work Queue Item 1 trace
6. **Close drawer** → Should close and reset selection

### Automated Testing (Future)
```typescript
describe('Trace Replay', () => {
  it('opens correct trace for work queue item 1', () => {
    render(<ConsoleDashboard />);
    fireEvent.click(screen.getByText('Open trace').first());
    expect(screen.getByText('trace-2025-12-19-08-30-00-abc123')).toBeInTheDocument();
  });
  
  it('shows unique scenarios for each work queue item', () => {
    // Verify each "Open trace" button shows different trace_id
  });
});
```

## Summary

- ✅ Each work queue item has a unique `trace_id`
- ✅ Traces are stored in `TRACE_REPLAYS` dictionary for easy lookup
- ✅ State management uses lightweight `selectedTraceId` (not full objects)
- ✅ Clicking "Open trace" calls `handleViewTrace(traceId)`
- ✅ Drawer resolves trace data from `TRACE_REPLAYS[selectedTraceId]`
- ✅ 3 unique traces for 3 work queue items (Ohio Hospital, NY Pharmacy, Researcher)
- ✅ Closing drawer resets selection state
- ✅ Ready for backend integration (just replace dictionary with API fetch)

To add new traces: Create `TraceData` object → Add to `TRACE_REPLAYS` → Link from work queue item or button → Done!
