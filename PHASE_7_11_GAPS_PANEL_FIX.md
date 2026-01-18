# PHASE 7.11 — Gaps Panel UI Fix

**Status:** ✅ COMPLETE  
**Date:** January 18, 2026

## Problem

Information Gaps panel in Console > Summary showed many blank rows with only LOW/MEDIUM severity badges but no content, cluttering the UI and reducing usability.

## Root Cause

The GapsPanel component was rendering all gaps from the backend without:
1. **Filtering empty gaps**: Gaps with empty `description`, `affected_area`, and `expected_signal` were rendered as blank rows
2. **Deduplication**: Identical gaps were displayed multiple times
3. **Long list management**: No pagination or collapse for sections with many items

## Solution Implemented

### 1. Gap Normalization (`normalizeGaps()` helper)

Added intelligent filtering and deduplication:

```typescript
function normalizeGaps(gaps: Gap[]): NormalizedGap[] {
  const seen = new Set<string>();
  const normalized: NormalizedGap[] = [];

  for (const gap of gaps) {
    // Filter: keep only gaps with meaningful content
    const hasContent = (gap.description && gap.description.trim()) ||
                       (gap.affected_area && gap.affected_area.trim()) ||
                       (gap.expected_signal && gap.expected_signal.trim());
    
    if (!hasContent) continue;

    // Build displayTitle
    const displayTitle = gap.description?.trim() || 
                        `${gap.affected_area || gap.gap_type || 'gap'} (${gap.gap_type || 'unknown'})`;

    // Dedupe key: severity|gap_type|displayTitle
    const dedupeKey = `${gap.severity}|${gap.gap_type}|${displayTitle}`;
    
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    normalized.push({ ...gap, displayTitle, dedupeKey });
  }

  return normalized;
}
```

**Key Features:**
- **Empty filtering**: Gaps must have at least one non-empty field (description, affected_area, or expected_signal)
- **Smart title generation**:
  - Prefers `description` if present
  - Falls back to `"{affected_area} ({gap_type})"` format
- **Deduplication**: Uses composite key `severity|gap_type|displayTitle` to prevent duplicates

### 2. Expand/Collapse for Long Lists

Added state management and toggle buttons per severity section:

```typescript
const [expandedSeverities, setExpandedSeverities] = useState<Record<string, boolean>>({
  high: false,
  medium: false,
  low: false,
});

const displayLimit = 8;
const hasMore = gapsForSeverity.length > displayLimit;
const displayedGaps = isExpanded ? gapsForSeverity : gapsForSeverity.slice(0, displayLimit);
```

**Behavior:**
- Show first 8 gaps by default per severity
- "Show all N {severity} priority gaps" button when count > 8
- "Show less (8 of N)" button when expanded
- Independent toggle state per severity section

### 3. Enhanced Gap Display

Each gap row now shows:
- Gap type icon (✗, ◐, ▽, ⏱)
- `displayTitle` as primary text (guaranteed non-empty)
- Affected area (if different from title)
- Expected signal (if present)
- Severity badge (HIGH/MEDIUM/LOW)

## Files Modified

### Backend
- `backend/scripts/migrate_add_intelligence_history.py` (NEW)
- `backend/app/intelligence/repository.py` (+169 lines)
- `backend/app/intelligence/service.py` (modified recompute)
- `backend/app/intelligence/router.py` (+220 lines)
- `backend/tests/test_phase7_11_intelligence_history.py` (NEW - 6 tests)

### Frontend
- `frontend/src/features/intelligence/GapsPanel.tsx` (major refactor)
  - Added `normalizeGaps()` function
  - Added expand/collapse state management
  - Changed from `gap.description` to `gap.displayTitle`
  - Added "Show all/Show less" buttons
- `frontend/src/test/intelligence.test.tsx` (+6 new tests)
- `frontend/package.json` (added @testing-library/user-event)

## Testing

### Backend Tests ✅
All 6 Phase 7.11 backend tests passing:
- ✅ `test_insert_intelligence_history`
- ✅ `test_multiple_history_entries_ordered_correctly`
- ✅ `test_history_retrieval_respects_limit`
- ✅ `test_cleanup_old_history_keeps_last_n`
- ✅ `test_diff_computation_basic`
- ✅ `test_history_payload_contains_all_required_fields`

### Frontend Tests ✅
All 33 intelligence tests passing (6 new for GapsPanel):
- ✅ `filters out empty gaps with no content`
- ✅ `deduplicates identical gaps`
- ✅ `shows expand/collapse toggle when more than 8 gaps`
- ✅ `builds displayTitle from description when available`
- ✅ `builds displayTitle from affected_area and gap_type when description is empty`
- ✅ `shows "No Information Gaps" when all gaps are empty`

### Build ✅
- `npm run build` successful
- No TypeScript errors
- Bundle size: 940 KB (gzip: 220 KB)

## UI Improvements

**Before:**
- 20+ blank rows with only severity badges
- Duplicate gaps repeated multiple times
- No way to collapse long lists

**After:**
- Zero blank rows (all gaps have meaningful content)
- Each unique gap appears once
- Long lists collapsed to first 8 with expand toggle
- Clear, human-readable titles for every gap

## User Impact

1. **Cleaner UI**: No more scrolling through empty rows
2. **Reduced Noise**: Deduplication eliminates redundant information
3. **Better Performance**: Fewer DOM nodes rendered by default
4. **Improved UX**: Expand/collapse puts users in control of detail level

## Next Steps

- [x] Backend: Intelligence history tracking (Phase 7.11)
- [x] Frontend: Fix GapsPanel blank rows
- [x] Tests: Comprehensive coverage for gaps normalization
- [ ] Frontend: History UI panel (show last 5 intelligence computations)
- [ ] Frontend: "What changed" diff card (deltas with green/red indicators)

---

**Phase 7.11 Status:** Backend complete ✅ | Gaps Panel UI fixed ✅ | History UI pending
