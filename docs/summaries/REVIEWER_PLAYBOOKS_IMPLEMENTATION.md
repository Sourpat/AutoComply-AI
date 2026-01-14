# Reviewer Playbooks Implementation - Step 2.15

## Overview
Added comprehensive reviewer playbooks for three new decision types:
- **Ohio TDDD** (Terminal Distributor of Dangerous Drugs)
- **NY Pharmacy License** (New York pharmacy license verification)
- **CSF Facility** (Hospital/facility controlled substance facilitator)

All playbooks follow the established pattern from `csf_practitioner` and integrate seamlessly with the existing Workbench tab adherence tracking.

---

## Frontend Implementation

### 1. New Playbook Files Created

#### `frontend/src/playbooks/ohioTdddPlaybook.ts`
- **12 steps** covering Ohio TDDD license verification workflow
- **Step IDs:** `review_submission`, `validate_tddd_license`, `verify_category_authorization`, `validate_responsible_pharmacist`, `inspect_storage_security`, `review_inspection_history`, `verify_dispensing_protocol`, `validate_wholesale_records`, `check_biennial_renewal`, `verify_oarrs_reporting`, `review_staff_training`, `final_disposition`
- **Severity levels:** 3 block, 4 review, 5 info
- **7 suggested actions:** Approve, request license clarification, request pharmacist info, request storage compliance, flag for review, block, add note

#### `frontend/src/playbooks/nyPharmacyLicensePlaybook.ts`
- **12 steps** covering NY pharmacy license verification workflow
- **Step IDs:** `review_submission`, `validate_pharmacy_license`, `verify_pharmacist_in_charge`, `validate_nysdoh_registration`, `verify_bne_registration`, `inspect_facility_standards`, `verify_istop_compliance`, `check_staffing_ratios`, `validate_prescription_records`, `verify_compounding_registration`, `check_triennial_renewal`, `final_disposition`
- **Severity levels:** 4 block, 5 review, 3 info
- **8 suggested actions:** Approve, request license clarification, request PIC info, request registration info, request I-STOP compliance, flag for review, block, add note

#### `frontend/src/playbooks/csfFacilityPlaybook.ts`
- **13 steps** covering CSF facility verification workflow
- **Step IDs:** `review_submission`, `validate_facility_dea`, `validate_state_license`, `verify_responsible_person`, `inspect_storage_security`, `validate_recordkeeping`, `check_biennial_inventory`, `review_diversion_program`, `verify_staff_training`, `validate_theft_procedures`, `review_inspection_history`, `check_dea_renewal`, `final_disposition`
- **Severity levels:** 5 block, 5 review, 3 info
- **9 suggested actions:** Approve, request DEA info, request license info, request responsible person info, request storage compliance, request diversion program, flag for review, block, add note

### 2. Playbook Registry (`frontend/src/playbooks/index.ts`)
Created centralized playbook registry with helper functions:
```typescript
export const playbookRegistry: Record<string, Playbook> = {
  csf_practitioner: csfPractitionerPlaybook,
  ohio_tddd: ohioTdddPlaybook,
  ny_pharmacy_license: nyPharmacyLicensePlaybook,
  csf_facility: csfFacilityPlaybook,
};

// Helper functions
export function getPlaybookForDecisionType(decisionType: string): Playbook | null
export function getAllPlaybooks(): Playbook[]
export function hasPlaybook(decisionType: string): boolean
export function getPlaybookStepCount(decisionType: string): number
```

### 3. Updated Components

#### `frontend/src/features/cases/PlaybookPanel.tsx`
- Updated imports to use centralized registry
- Changed from hardcoded `if/else` to registry lookup: `getPlaybookForDecisionType(decisionType)`
- Now supports all 4 decision types dynamically

#### `frontend/src/workflow/playbookEngine.ts`
- Updated `getPlaybookByDecisionType()` to use registry instead of returning null
- Enables dynamic playbook loading for coverage dashboard and other consumers

---

## Backend Implementation

### Updated Files

#### `backend/app/workflow/adherence.py`
Added three new playbook definitions matching frontend steps:

1. **OHIO_TDDD_PLAYBOOK** (12 steps)
   - Maps each step to audit event signals (e.g., `license_verified`, `category_verified`, `pharmacist_verified`)
   - Tracks completion based on audit events

2. **NY_PHARMACY_LICENSE_PLAYBOOK** (12 steps)
   - Maps to NY-specific audit signals (`pic_verified`, `bne_verified`, `istop_verified`)
   - Supports triennial renewal tracking

3. **CSF_FACILITY_PLAYBOOK** (13 steps)
   - Maps to facility-specific signals (`dea_verified`, `security_verified`, `diversion_verified`)
   - Tracks institutional compliance steps

**Updated PLAYBOOKS registry:**
```python
PLAYBOOKS = {
    "csf": CSF_PRACTITIONER_PLAYBOOK,
    "csf_practitioner": CSF_PRACTITIONER_PLAYBOOK,
    "ohio_tddd": OHIO_TDDD_PLAYBOOK,
    "ny_pharmacy_license": NY_PHARMACY_LICENSE_PLAYBOOK,
    "csf_facility": CSF_FACILITY_PLAYBOOK,
    # Legacy mappings
    "csf_hospital": CSF_FACILITY_PLAYBOOK,
    "csf_ems": GENERIC_PLAYBOOK,
    "csf_researcher": GENERIC_PLAYBOOK,
    "license_ohio_tddd": OHIO_TDDD_PLAYBOOK,
    "license_ny_pharmacy": NY_PHARMACY_LICENSE_PLAYBOOK,
}
```

**Enhanced `generate_recommendation()` function:**
- Added 30+ step-specific action recommendations
- Covers all steps from all 4 decision types
- Provides contextual guidance for reviewers

---

## Integration with Workbench Tab

### Existing Adherence Tracking (No Changes Needed)
The Workbench tab in `CaseDetailsPanel.tsx` already supports all decision types:

1. **Playbook Adherence Badge**
   - Shows completion percentage (0-100%)
   - Color-coded: green (≥80%), yellow (50-79%), red (<50%)

2. **Steps Grid**
   - **Completed Steps**: Green cards showing satisfied requirements
   - **Missing Steps**: Gray cards showing pending actions

3. **Recommended Next Actions**
   - Maps missing steps to actionable buttons:
     - "Open Evidence" → Navigate to Summary tab
     - "Request Info" → Open request info modal
     - "Update Status" → Navigate to Summary tab
     - "Add Note" → Navigate to Notes tab

4. **Audit Event Signal Matching**
   - Backend calculates adherence based on audit events
   - Frontend highlights steps based on:
     - `firedRules` from evaluator output
     - `missingEvidence` from evaluator output
     - Case status and available evidence

### Step Highlighting Logic (PlaybookPanel)
Steps are automatically highlighted based on:
- **Blocked**: Red - fired rules with `severity: "block"`
- **Attention**: Yellow - fired rules with `severity: "review"` or missing evidence
- **Satisfied**: Green - no fired rules, evidence present
- **Pending**: Gray - not yet evaluated

---

## Decision Type Mapping

| Frontend decisionType | Backend decision_type | Playbook Used |
|----------------------|----------------------|---------------|
| `csf_practitioner` | `csf_practitioner` | CSF_PRACTITIONER_PLAYBOOK |
| `ohio_tddd` | `ohio_tddd` | OHIO_TDDD_PLAYBOOK |
| `ny_pharmacy_license` | `ny_pharmacy_license` | NY_PHARMACY_LICENSE_PLAYBOOK |
| `csf_facility` | `csf_facility` | CSF_FACILITY_PLAYBOOK |

---

## Testing Checklist

### Frontend Testing
- [ ] Load case with `decisionType: "ohio_tddd"` → Playbook tab shows 12 Ohio TDDD steps
- [ ] Load case with `decisionType: "ny_pharmacy_license"` → Playbook tab shows 12 NY Pharmacy steps
- [ ] Load case with `decisionType: "csf_facility"` → Playbook tab shows 13 CSF Facility steps
- [ ] Verify step highlighting based on fired rules and missing evidence
- [ ] Test suggested actions render correctly for each decision type
- [ ] Verify adherence percentage calculation in Workbench tab

### Backend Testing
- [ ] Call adherence endpoint for ohio_tddd case → Returns 12 steps
- [ ] Call adherence endpoint for ny_pharmacy_license case → Returns 12 steps
- [ ] Call adherence endpoint for csf_facility case → Returns 13 steps
- [ ] Verify audit event signals map to step completion
- [ ] Test recommended next actions include decision-type-specific guidance

---

## Files Modified

### Frontend
- ✅ `frontend/src/playbooks/ohioTdddPlaybook.ts` (NEW - 203 lines)
- ✅ `frontend/src/playbooks/nyPharmacyLicensePlaybook.ts` (NEW - 218 lines)
- ✅ `frontend/src/playbooks/csfFacilityPlaybook.ts` (NEW - 232 lines)
- ✅ `frontend/src/playbooks/index.ts` (NEW - 46 lines)
- ✅ `frontend/src/features/cases/PlaybookPanel.tsx` (MODIFIED - simplified to use registry)
- ✅ `frontend/src/workflow/playbookEngine.ts` (MODIFIED - updated getPlaybookByDecisionType)

### Backend
- ✅ `backend/app/workflow/adherence.py` (MODIFIED - added 3 playbooks + enhanced recommendations)

---

## Adherence Scoring Formula

```python
adherence_pct = (completed_steps / total_steps) * 100

# Step completion criteria:
# - Step is marked complete if ANY of its audit signals are present in case audit events
# - Example: "validate_tddd_license" completes when audit event contains "license_verified" or "packet_updated"
```

**Audit Event Signals by Decision Type:**

**Ohio TDDD:**
- `license_verified`, `category_verified`, `pharmacist_verified`
- `facility_inspected`, `inspection_reviewed`, `protocol_verified`
- `records_reviewed`, `oarrs_verified`, `training_verified`

**NY Pharmacy License:**
- `license_verified`, `pic_verified`, `registration_verified`, `bne_verified`
- `facility_inspected`, `istop_verified`, `staffing_verified`
- `records_reviewed`, `compounding_verified`, `renewal_checked`

**CSF Facility:**
- `dea_verified`, `license_verified`, `responsible_verified`
- `security_verified`, `records_reviewed`, `inventory_verified`
- `diversion_verified`, `training_verified`, `procedures_verified`

---

## Next Steps (Future Enhancements)

1. **Coverage Dashboard Integration**
   - Update coverage dashboard to show playbook step counts for new decision types
   - Use `getPlaybookStepCount()` from registry

2. **Playbook Export**
   - Add CSV/PDF export of playbook checklists for offline use

3. **Custom Playbooks**
   - Allow admins to create custom playbooks per jurisdiction

4. **Step Dependencies**
   - Add prerequisite logic (e.g., "Can't check renewal until license validated")

5. **Time Tracking**
   - Track time spent per playbook step for efficiency metrics

---

## Summary

✅ **3 new playbooks created** with 12-13 steps each (37 total new steps)  
✅ **Centralized registry** for easy maintenance and extension  
✅ **Workbench tab integration** - no changes needed, works automatically  
✅ **Adherence tracking** - backend playbooks match frontend step IDs  
✅ **Step highlighting** - evaluator output drives visual feedback  
✅ **Recommended actions** - 30+ decision-type-specific recommendations  

All playbooks follow the established `csf_practitioner` pattern and integrate seamlessly with existing Playbook Panel, Workbench tab, and adherence scoring systems.
