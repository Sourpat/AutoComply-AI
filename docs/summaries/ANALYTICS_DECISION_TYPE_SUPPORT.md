# Analytics Decision Type Support - Complete Implementation

## Overview

Updated the analytics system to properly support all decision types dynamically without hardcoding. The system now:
- ✅ Derives decision types from actual data (not hardcoded lists)
- ✅ Supports filtering by decision type across all metrics
- ✅ Aggregates evidence tags from all cases (with optional filtering)
- ✅ Renders cleanly when decision types have no data

## Decision Types Supported

The system dynamically supports all decision types present in the database:

1. **csf_practitioner** - CSF registration for individual practitioners
2. **ohio_tddd** - Ohio Terminal Distributor of Dangerous Drugs license
3. **ny_pharmacy_license** - New York pharmacy license verification
4. **csf_facility** - CSF registration for hospitals/facilities

*Note: The frontend dropdown is dynamically populated from the `decisionTypeBreakdown` API response, so new decision types are automatically supported without code changes.*

## Backend Changes

### 1. Analytics Router (app/analytics/router.py)

**Updated `get_analytics_overview()` to apply filters:**
```python
return analytics_repo.get_analytics(
    days=days,
    decision_type=decisionType  # Now passes filter to repo
)
```

**Before:** Router accepted `decisionType` parameter but ignored it and returned full analytics.

**After:** Router passes `decisionType` to repository methods for actual filtering.

### 2. Analytics Repository (app/analytics/repo.py)

**Updated method signatures to accept optional `decision_type` filter:**

#### `get_analytics(days, decision_type)`
- Accepts optional `decision_type` filter parameter
- Passes filter to all sub-methods (summary, breakdowns, time series)

#### `get_summary(decision_type)`
- Adds `WHERE decisionType = :decision_type` clause when filter provided
- Filters: total cases, open cases, closed cases, overdue cases, due soon cases

**Example:**
```python
dt_filter = "" if not decision_type else " AND decisionType = :decision_type"
params = {"decision_type": decision_type} if decision_type else {}

total_result = execute_sql(
    f"SELECT COUNT(*) as count FROM cases WHERE 1=1{dt_filter}",
    params
)
```

#### `get_status_breakdown(decision_type)`
- Filters status distribution by decision type when provided

#### `get_cases_created_time_series(days, decision_type)`
- Filters time series of cases created by decision type

#### `get_cases_closed_time_series(days, decision_type)`
- Filters time series of cases closed by decision type

#### `get_evidence_tags(limit, decision_type)`
- Filters evidence tag aggregation by decision type
- Already includes evidence from all cases (no changes needed for aggregation logic)
- Now supports optional filtering to show tags for specific decision type

**Before:** Decision type breakdown was already dynamic (used `GROUP BY decisionType`), but other metrics couldn't be filtered.

**After:** All metrics support optional decision type filtering while maintaining dynamic discovery of types.

## Frontend Changes

### 1. Analytics Dashboard (frontend/src/pages/AnalyticsDashboardPage.tsx)

**Replaced hardcoded DECISION_TYPES constant with dynamic population:**

#### Before (Hardcoded):
```typescript
const DECISION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'csf_practitioner', label: 'CSF - Practitioner' },
  { value: 'csf_facility', label: 'CSF - Facility' },
  { value: 'csf_ems', label: 'CSF - EMS' },          // ❌ Not implemented
  { value: 'csf_researcher', label: 'CSF - Researcher' }, // ❌ Not implemented
  { value: 'ohio_tddd', label: 'Ohio TDDD License' },
  { value: 'ny_pharmacy_license', label: 'NY Pharmacy License' },
];
```

**Problems with hardcoded approach:**
- Showed unimplemented types (csf_ems, csf_researcher)
- Required code changes when adding new decision types
- Could get out of sync with backend data

#### After (Dynamic):
```typescript
// Helper function for labels
function getDecisionTypeLabel(decisionType: string): string {
  const labels: Record<string, string> = {
    'csf_practitioner': 'CSF - Practitioner',
    'csf_facility': 'CSF - Facility',
    'csf_ems': 'CSF - EMS',
    'csf_researcher': 'CSF - Researcher',
    'ohio_tddd': 'Ohio TDDD License',
    'ny_pharmacy_license': 'NY Pharmacy License',
  };
  return labels[decisionType] || decisionType;
}

// State for dynamic decision types
const [availableDecisionTypes, setAvailableDecisionTypes] = useState<Array<{value: string, label: string}>>([]);

// Populate from analytics data
const loadAllData = async () => {
  const data = await getAnalyticsOverview({...});
  
  // Extract unique decision types from breakdown
  if (data.decisionTypeBreakdown && data.decisionTypeBreakdown.length > 0) {
    const types = [{ value: '', label: 'All Types' }].concat(
      data.decisionTypeBreakdown.map(item => ({
        value: item.decisionType,
        label: getDecisionTypeLabel(item.decisionType)
      }))
    );
    setAvailableDecisionTypes(types);
  } else {
    setAvailableDecisionTypes([{ value: '', label: 'All Types' }]);
  }
};

// Use in dropdown
<select value={filters.decisionType} onChange={...}>
  {availableDecisionTypes.map(opt => (
    <option key={opt.value} value={opt.value}>{opt.label}</option>
  ))}
</select>
```

**Benefits of dynamic approach:**
- ✅ Only shows decision types that actually have data
- ✅ Automatically includes new decision types without code changes
- ✅ Always stays in sync with backend
- ✅ Gracefully handles empty state (no data yet)

### 2. Saved View Support (Already Exists)

The saved views feature already captures `decisionType` in the filter state, so saved analytics views with decision type filters work automatically:

```typescript
interface SavedView {
  id: string;
  name: string;
  description: string;
  context: 'console' | 'analytics';
  filters: {
    decisionType?: string;  // Already captured
    assignedTo?: string;
    days?: number;
    // ... other filters
  };
}
```

## Data Flow

### 1. Decision Type Discovery (Frontend → Backend)
```
1. Frontend loads analytics: GET /api/analytics/overview
2. Backend queries: SELECT decisionType, COUNT(*) FROM cases GROUP BY decisionType
3. Response includes decisionTypeBreakdown: [
     { decisionType: "csf_practitioner", count: 45 },
     { decisionType: "ohio_tddd", count: 23 },
     { decisionType: "ny_pharmacy_license", count: 12 },
     { decisionType: "csf_facility", count: 8 }
   ]
4. Frontend extracts types from breakdown
5. Frontend populates dropdown with actual types
```

### 2. Decision Type Filtering (Frontend → Backend → Database)
```
1. User selects "Ohio TDDD License" from dropdown
2. Frontend updates filter state: { decisionType: "ohio_tddd" }
3. Frontend calls API: GET /api/analytics/overview?decisionType=ohio_tddd
4. Backend router passes to repo: get_analytics(decision_type="ohio_tddd")
5. Backend repo adds WHERE clauses:
   - Summary: WHERE decisionType = 'ohio_tddd'
   - Status breakdown: WHERE decisionType = 'ohio_tddd'
   - Time series: WHERE createdAt >= :cutoff AND decisionType = 'ohio_tddd'
   - Evidence tags: WHERE evidence IS NOT NULL AND decisionType = 'ohio_tddd'
6. Backend returns filtered analytics
7. Frontend displays metrics for Ohio TDDD only
```

## Empty State Handling

### Frontend Null Safety

**Decision Types Dropdown:**
```typescript
if (data.decisionTypeBreakdown && data.decisionTypeBreakdown.length > 0) {
  // Populate from data
} else {
  // Fallback to empty state
  setAvailableDecisionTypes([{ value: '', label: 'All Types' }]);
}
```

**Rendering Breakdowns:**
- Status breakdown renders empty array gracefully
- Decision type breakdown shows all types (from database)
- Time series renders empty chart when no data
- Evidence tags shows "No evidence tags" when empty

### Backend Null Safety

All repository methods handle empty result sets:
```python
total_result = execute_sql("SELECT COUNT(*) as count FROM cases")
total_cases = total_result[0]["count"] if total_result else 0  # Safe access
```

## Testing Checklist

### ✅ Backend Tests

- [x] Decision type breakdown returns all types dynamically
- [x] Evidence tag aggregation includes all cases
- [x] Decision type filtering works in summary metrics
- [x] Decision type filtering works in status breakdown
- [x] Decision type filtering works in time series (created)
- [x] Decision type filtering works in time series (closed)
- [x] Decision type filtering works in evidence tags
- [x] Empty decision type parameter returns unfiltered results

### ✅ Frontend Tests

- [x] Dropdown shows only decision types with data
- [x] Dropdown includes "All Types" option
- [x] Selecting decision type filters all metrics
- [x] Empty state renders without errors
- [x] Saved views capture decision type filter
- [x] Saved views restore decision type filter

## API Reference

### GET /api/analytics/overview

**Query Parameters:**
- `days` (int, optional): Number of days for time series (default: 30)
- `decisionType` (string, optional): Filter by decision type (e.g., "csf_practitioner", "ohio_tddd")
- `assignedTo` (string, optional): Filter by assignee (not yet implemented)

**Response:**
```typescript
{
  summary: {
    totalCases: number;
    openCases: number;
    closedCases: number;
    overdueCases: number;
    dueSoonCases: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  decisionTypeBreakdown: Array<{ decisionType: string; count: number }>;  // Always unfiltered
  casesCreatedTimeSeries: Array<{ date: string; count: number }>;
  casesClosedTimeSeries: Array<{ date: string; count: number }>;
  topEventTypes: Array<{ eventType: string; count: number }>;
  verifierActivity: Array<{ actor: string; count: number }>;
  evidenceTags: Array<{ tag: string; count: number }>;
  requestInfoReasons: Array<{ reason: string; count: number }>;
}
```

**Note:** `decisionTypeBreakdown` is always unfiltered (shows all types) because it's used to populate the filter dropdown. All other metrics respect the `decisionType` filter when provided.

## Architecture Decisions

### Why Dynamic Decision Type Discovery?

**Alternative 1: Hardcode decision types in frontend**
- ❌ Requires code changes for new types
- ❌ Can get out of sync with backend
- ❌ Shows unimplemented types

**Alternative 2: Backend metadata endpoint**
- ❌ Extra API call
- ❌ Still needs to maintain list somewhere
- ✅ Could include type metadata

**Chosen: Derive from analytics data** ✅
- ✅ No extra API calls (uses existing data)
- ✅ Always in sync with actual data
- ✅ Automatically supports new types
- ✅ Only shows types that have cases

### Why decision_type Parameter in All Repo Methods?

**Alternative 1: Single WHERE clause in get_analytics()**
- ❌ Harder to test individual methods
- ❌ Less flexible for future enhancements

**Chosen: Parameter in each method** ✅
- ✅ Each method testable independently
- ✅ Flexible for complex queries
- ✅ Clear responsibility per method

## Related Features

### Console Queue Decision Type Filtering
The console queue also supports decision type filtering with:
- Color-coded badges on case cards
- Decision type filter buttons
- URL parameter sync
- Saved views integration

See [CONSOLE_ENHANCEMENTS_COMPLETE.md](./CONSOLE_ENHANCEMENTS_COMPLETE.md) for details.

### Coverage Service Decision Type Support
The coverage service derives real counts for each decision type from:
- Playbook registry (step counts)
- Regulatory seed data (rule counts, evidence source counts)

See coverage service implementation for details.

## Future Enhancements

### 1. Decision Type Metadata Endpoint (Optional)
Could add `/api/metadata/decision-types` to provide:
- Available decision types
- Human-readable labels
- Descriptions
- Icons/colors

**Benefits:**
- Centralized type configuration
- Richer type information

**Tradeoffs:**
- Extra API call
- More complexity
- Current approach works well

### 2. Assignee Filtering (Planned)
The `assignedTo` parameter exists but filtering not yet implemented because:
- Cases don't have direct assignee field
- Would need to track assignment in audit events or add field

**Implementation:**
- Add `assignedTo` field to cases table, OR
- Query audit events for assignment events

### 3. Multi-Select Decision Type Filter
Could allow filtering by multiple decision types:
- UI: Multi-select dropdown or checkboxes
- API: `decisionType=ohio_tddd,ny_pharmacy_license`
- Backend: `WHERE decisionType IN (:types)`

## Verification Steps

### 1. Check Decision Type Breakdown
```bash
# Backend should return all types from database
curl http://localhost:8001/api/analytics/overview | jq '.decisionTypeBreakdown'

# Expected output (example):
[
  { "decisionType": "csf_practitioner", "count": 45 },
  { "decisionType": "ohio_tddd", "count": 23 },
  { "decisionType": "ny_pharmacy_license", "count": 12 },
  { "decisionType": "csf_facility", "count": 8 }
]
```

### 2. Check Decision Type Filtering
```bash
# Filter by csf_practitioner
curl "http://localhost:8001/api/analytics/overview?decisionType=csf_practitioner" | jq '.summary.totalCases'

# Should return count of only csf_practitioner cases (e.g., 45)
```

### 3. Check Frontend Dropdown
1. Open Analytics Dashboard
2. Verify dropdown shows only types with data
3. Verify "All Types" option exists
4. Select a specific type
5. Verify all metrics update to show filtered data

### 4. Check Empty State
1. Clear all cases from database (or use clean DB)
2. Open Analytics Dashboard
3. Verify dropdown shows only "All Types"
4. Verify charts/tables render without errors
5. Verify appropriate "No data" messages appear

## Summary

✅ **Backend:**
- Decision type breakdown already dynamic (GROUP BY decisionType)
- Evidence aggregation already includes all cases
- Decision type filtering now implemented across all metrics
- All methods accept optional `decision_type` parameter

✅ **Frontend:**
- Removed hardcoded DECISION_TYPES constant
- Dynamically populate dropdown from analytics data
- Only shows decision types that actually have cases
- Gracefully handles empty state

✅ **Benefits:**
- No code changes needed for new decision types
- Always in sync with actual data
- Clean rendering with no data
- Filtering works across all analytics metrics

The analytics system now properly supports all decision types dynamically and provides comprehensive filtering capabilities!
