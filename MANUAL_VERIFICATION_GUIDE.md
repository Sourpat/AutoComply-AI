# Manual Verification Guide - All Decision Types

## Overview
This guide provides step-by-step verification for all 4 decision types:
1. **csf_practitioner** - DEA CSF for individual practitioners
2. **ohio_tddd** - Ohio Terminal Distributor of Dangerous Drugs license
3. **ny_pharmacy_license** - New York pharmacy license verification  
4. **csf_facility** - DEA CSF for hospitals/facilities

## Prerequisites
- Backend running on port 8001
- Frontend running on dev server
- Clean database or test environment

## Decision Type 1: CSF Practitioner

### 1.1 Submit Form
1. Navigate to `/submissions/csf-practitioner`
2. Fill out form:
   - Practitioner Name: "Dr. Jane Smith"
   - NPI: "1234567890"
   - DEA: "AS1234567"
   - State License: "MD12345"
   - Schedule II Activities: Yes
   - Attestation: Check
3. Click "Submit for Review"
4. ✅ **Verify**: Success message appears
5. ✅ **Verify**: Case ID is displayed

### 1.2 Console - Decision Type Badge
1. Navigate to `/console`
2. ✅ **Verify**: New case appears in work queue
3. ✅ **Verify**: Badge shows "CSF - Practitioner" in **blue** color
4. ✅ **Verify**: decisionType filter button shows badge can be filtered

### 1.3 Evidence & Explainability
1. Click on the case to open details drawer
2. ✅ **Verify**: Evidence section shows attached regulatory documents
3. ✅ **Verify**: Evidence items have source citations
4. Click "View Explainability" or navigate to `/console/rag?caseId=<caseId>`
5. ✅ **Verify**: Deterministic evaluator output shows:
   - Rules evaluated
   - Evidence matched
   - Decision rationale
6. ✅ **Verify**: Trace recording panel shows evaluation steps

### 1.4 Workbench - Playbook Adherence
1. With case selected, click "Workbench" tab or navigate to `/console/workbench?caseId=<caseId>`
2. ✅ **Verify**: Playbook adherence score is displayed (0-100%)
3. ✅ **Verify**: Playbook steps show status:
   - ✓ Complete (green)
   - ⚠ Incomplete (yellow)
   - ○ Pending (gray)
4. ✅ **Verify**: Recommended actions section shows:
   - Contextual suggestions based on playbook
   - "Approve", "Request Info", or "Block" buttons
5. ✅ **Verify**: Playbook steps count matches **12 steps** (CSF practitioner playbook)

### 1.5 Coverage Page
1. Navigate to `/console/coverage`
2. Select "CSF - Practitioner" from decision type filter
3. ✅ **Verify**: Coverage metrics show:
   - Rules Count: **12** (actual from seed data)
   - Evidence Sources: **6** (actual from seed data)
   - Evidence Tags Present: Dynamic count
   - Playbook Step Count: **12** (actual from playbook)
4. ✅ **Verify**: Progress bars show non-zero values
5. ✅ **Verify**: Evaluator coverage shows "Deterministic Evaluator: ✓ Implemented"

### 1.6 Analytics Dashboard
1. Navigate to `/analytics`
2. ✅ **Verify**: Decision Type Breakdown chart includes "CSF - Practitioner" with count ≥ 1
3. Select "CSF - Practitioner" from decision type filter dropdown
4. ✅ **Verify**: Metrics update to show only CSF practitioner cases:
   - Total Cases
   - Open Cases
   - Closed Cases
   - Status Breakdown
5. ✅ **Verify**: Time series charts show data points for CSF practitioner cases

---

## Decision Type 2: Ohio TDDD

### 2.1 Submit Form
1. Navigate to `/submissions/ohio-tddd`
2. Fill out form:
   - Business Name: "Main Street Pharmacy"
   - Business Address: "123 Main St, Columbus, OH 43215"
   - Phone Number: "614-555-0100"
   - Responsible Pharmacist Name: "John Doe, RPh"
   - Responsible Pharmacist License: "03.123456"
   - Requested Substances: "Schedule II, III, IV, V"
   - Storage Security Compliant: Yes
   - Attestation: Check
3. Click "Submit for Review"
4. ✅ **Verify**: Success message appears
5. ✅ **Verify**: Case ID is displayed

### 2.2 Console - Decision Type Badge
1. Navigate to `/console`
2. ✅ **Verify**: New case appears in work queue
3. ✅ **Verify**: Badge shows "Ohio TDDD" in **orange** color
4. ✅ **Verify**: decisionType filter can isolate Ohio TDDD cases

### 2.3 Evidence & Explainability
1. Click on the case to open details drawer
2. ✅ **Verify**: Evidence section shows Ohio Board of Pharmacy rules
3. ✅ **Verify**: Evidence citations reference Ohio Administrative Code
4. Click "View Explainability"
5. ✅ **Verify**: Deterministic evaluator shows:
   - Ohio TDDD-specific rules evaluated
   - Business compliance checks
   - Pharmacist license validation
6. ✅ **Verify**: Trace panel shows Ohio-specific evaluation logic

### 2.4 Workbench - Playbook Adherence
1. Open case in workbench
2. ✅ **Verify**: Playbook adherence shows Ohio TDDD playbook
3. ✅ **Verify**: Playbook steps count matches **12 steps**
4. ✅ **Verify**: Steps include Ohio-specific requirements:
   - Business registration validation
   - Pharmacist license check
   - Storage security assessment
   - Recordkeeping requirements
5. ✅ **Verify**: Recommended actions are contextual to Ohio TDDD

### 2.5 Coverage Page
1. Navigate to `/console/coverage`
2. Select "Ohio TDDD License" from filter
3. ✅ **Verify**: Coverage metrics show:
   - Rules Count: **10** (Ohio TDDD seed data)
   - Evidence Sources: **6** (Ohio TDDD seed data)
   - Playbook Step Count: **12** (Ohio TDDD playbook)
4. ✅ **Verify**: All metrics show non-zero counts

### 2.6 Analytics Dashboard
1. Navigate to `/analytics`
2. ✅ **Verify**: Decision Type Breakdown includes "Ohio TDDD License" with count ≥ 1
3. Filter by "Ohio TDDD License"
4. ✅ **Verify**: Dashboard shows Ohio TDDD-specific metrics
5. ✅ **Verify**: Empty decision types (if any) don't cause rendering errors

---

## Decision Type 3: NY Pharmacy License

### 3.1 Submit Form
1. Navigate to `/submissions/ny-pharmacy-license`
2. Fill out form:
   - Pharmacy Name: "Brooklyn Health Pharmacy"
   - Pharmacy Address: "456 Atlantic Ave, Brooklyn, NY 11217"
   - Phone Number: "718-555-0200"
   - Pharmacist in Charge Name: "Sarah Johnson, PharmD"
   - Pharmacist in Charge License: "123456"
   - Facility Type: "Community Pharmacy"
   - Performs Compounding: Yes
   - I-STOP Compliant: Yes
   - Attestation: Check
3. Click "Submit for Review"
4. ✅ **Verify**: Success message appears
5. ✅ **Verify**: Case ID is displayed

### 3.2 Console - Decision Type Badge
1. Navigate to `/console`
2. ✅ **Verify**: New case appears in work queue
3. ✅ **Verify**: Badge shows "NY Pharmacy" in **purple** color
4. ✅ **Verify**: Filter can isolate NY Pharmacy cases

### 3.3 Evidence & Explainability
1. Click on the case
2. ✅ **Verify**: Evidence shows NY Education Law and Public Health Law citations
3. Click "View Explainability"
4. ✅ **Verify**: Evaluator output shows:
   - NY-specific pharmacy rules
   - I-STOP compliance validation
   - Pharmacist license verification
   - Compounding facility requirements
5. ✅ **Verify**: Trace recording shows NY-specific logic

### 3.4 Workbench - Playbook Adherence
1. Open case in workbench
2. ✅ **Verify**: Playbook shows NY Pharmacy playbook
3. ✅ **Verify**: Step count matches **13 steps** (NY Pharmacy playbook)
4. ✅ **Verify**: Steps include NY-specific requirements:
   - I-STOP system verification
   - Pharmacist in charge validation
   - Compounding compliance (if applicable)
   - Facility inspection requirements
5. ✅ **Verify**: Progress tracking shows completed vs pending steps

### 3.5 Coverage Page
1. Navigate to `/console/coverage`
2. Select "NY Pharmacy License" from filter
3. ✅ **Verify**: Coverage metrics show:
   - Rules Count: **14** (NY Pharmacy seed data)
   - Evidence Sources: **7** (NY Pharmacy seed data)
   - Playbook Step Count: **13** (NY Pharmacy playbook)
4. ✅ **Verify**: Coverage percentages calculate correctly

### 3.6 Analytics Dashboard
1. Navigate to `/analytics`
2. ✅ **Verify**: Decision Type Breakdown includes "NY Pharmacy License" with count ≥ 1
3. Filter by "NY Pharmacy License"
4. ✅ **Verify**: All analytics sections render without errors
5. ✅ **Verify**: Evidence tags show NY-specific tags

---

## Decision Type 4: CSF Facility

### 4.1 Submit Form
1. Navigate to `/submissions/csf-facility`
2. Fill out form:
   - Facility Name: "Metro Hospital"
   - Facility Type: "Hospital"
   - Facility Address: "789 Medical Center Dr, Boston, MA 02115"
   - Phone Number: "617-555-0300"
   - DEA Registration Number: "RM1234567"
   - Facility Administrator Name: "Michael Chen, MBA"
   - Administrator Phone: "617-555-0301"
   - Schedule II Activities: Yes
   - Storage Security Compliant: Yes
   - Recordkeeping System Compliant: Yes
   - Diversion Prevention Program: Yes
   - Attestation: Check
3. Click "Submit for Review"
4. ✅ **Verify**: Success message appears
5. ✅ **Verify**: Case ID is displayed

### 4.2 Console - Decision Type Badge
1. Navigate to `/console`
2. ✅ **Verify**: New case appears in work queue
3. ✅ **Verify**: Badge shows "CSF - Facility" in **green** color
4. ✅ **Verify**: Filter can isolate CSF Facility cases

### 4.3 Evidence & Explainability
1. Click on the case
2. ✅ **Verify**: Evidence shows DEA facility-specific regulations
3. ✅ **Verify**: Citations reference 21 CFR for facility requirements
4. Click "View Explainability"
5. ✅ **Verify**: Evaluator shows:
   - Facility registration validation
   - Storage and security compliance
   - Recordkeeping system checks
   - Diversion prevention program review
6. ✅ **Verify**: Trace shows facility-specific evaluation steps

### 4.4 Workbench - Playbook Adherence
1. Open case in workbench
2. ✅ **Verify**: Playbook shows CSF Facility playbook
3. ✅ **Verify**: Step count matches **13 steps** (CSF Facility playbook)
4. ✅ **Verify**: Steps include facility-specific requirements:
   - DEA facility registration
   - Storage security compliance
   - Recordkeeping system validation
   - Diversion prevention program
   - Administrator qualifications
5. ✅ **Verify**: Recommended actions contextual to facility operations

### 4.5 Coverage Page
1. Navigate to `/console/coverage`
2. Select "CSF - Facility" from filter
3. ✅ **Verify**: Coverage metrics show:
   - Rules Count: **15** (CSF Facility seed data)
   - Evidence Sources: **8** (CSF Facility seed data)
   - Playbook Step Count: **13** (CSF Facility playbook)
4. ✅ **Verify**: All metrics show correct counts from actual data

### 4.6 Analytics Dashboard
1. Navigate to `/analytics`
2. ✅ **Verify**: Decision Type Breakdown includes "CSF - Facility" with count ≥ 1
3. Filter by "CSF - Facility"
4. ✅ **Verify**: Dashboard renders correctly with facility-specific data
5. ✅ **Verify**: Evidence tags include facility-specific tags

---

## Cross-Decision Type Verification

### Console Queue Multi-Type Test
1. Navigate to `/console`
2. ✅ **Verify**: All 4 decision type badges visible with distinct colors:
   - CSF - Practitioner: **Blue**
   - Ohio TDDD: **Orange**
   - NY Pharmacy: **Purple**
   - CSF - Facility: **Green**
3. Click each decision type filter button
4. ✅ **Verify**: Queue filters to show only selected type
5. ✅ **Verify**: URL updates with `decisionType` parameter
6. Save current view with decision type filter
7. Load saved view
8. ✅ **Verify**: Decision type filter restored correctly

### Coverage Page All Types
1. Navigate to `/console/coverage`
2. ✅ **Verify**: Decision type dropdown shows all 4 types:
   - CSF - Practitioner
   - Ohio TDDD License
   - NY Pharmacy License
   - CSF - Facility
3. ✅ **Verify**: No unimplemented types in dropdown (e.g., csf_ems, csf_researcher)
4. Cycle through each decision type
5. ✅ **Verify**: Metrics update correctly for each type
6. ✅ **Verify**: No hardcoded counts - all derived from actual data

### Analytics Dashboard All Types
1. Navigate to `/analytics`
2. ✅ **Verify**: Decision Type Breakdown chart shows all 4 types
3. ✅ **Verify**: Decision type dropdown dynamically populated from data
4. ✅ **Verify**: Dropdown shows only types with actual cases
5. ✅ **Verify**: Filtering by each type updates all dashboard sections:
   - Summary metrics
   - Status breakdown
   - Time series charts
   - Evidence tags
6. ✅ **Verify**: Empty filter ("All Types") shows aggregated data
7. ✅ **Verify**: No rendering errors when switching between types

### Evidence Cross-Type Validation
1. For each decision type, verify evidence includes:
   - ✅ CSF Practitioner: DEA practitioner-specific regulations
   - ✅ Ohio TDDD: Ohio Administrative Code citations
   - ✅ NY Pharmacy: NY Education Law citations
   - ✅ CSF Facility: DEA facility-specific regulations
2. ✅ **Verify**: Evidence tags are decision type-specific
3. ✅ **Verify**: Analytics evidence tag aggregation includes all types

### Playbook Cross-Type Validation
1. Verify playbook step counts:
   - ✅ CSF Practitioner: **12 steps**
   - ✅ Ohio TDDD: **12 steps**
   - ✅ NY Pharmacy: **13 steps**
   - ✅ CSF Facility: **13 steps**
2. ✅ **Verify**: Playbook steps are contextual to each decision type
3. ✅ **Verify**: Playbook adherence scores calculate independently per type

---

## Build & Deployment Verification

### TypeScript Compilation
1. Run `npm run build` in frontend directory
2. ✅ **Verify**: No TypeScript errors
3. ✅ **Verify**: Build completes successfully
4. ✅ **Verify**: No warnings about missing types or properties

### Backend API
1. Run backend tests (if available)
2. ✅ **Verify**: All decision type evaluators pass
3. ✅ **Verify**: Analytics endpoints return correct data
4. Test analytics endpoint with decisionType filter:
   ```bash
   curl "http://localhost:8001/analytics/overview?decisionType=csf_practitioner"
   ```
5. ✅ **Verify**: Response includes only CSF practitioner data

### No New Dependencies
1. Check `frontend/package.json`
2. ✅ **Verify**: No new npm packages added
3. Check `backend/requirements.txt`
4. ✅ **Verify**: No new Python packages added
5. ✅ **Verify**: All functionality uses existing dependencies

---

## Known Issues & Edge Cases

### Expected Behavior
- Empty decision types in analytics dropdown only appear after at least one case submitted
- Coverage metrics show 0 if no data seeded yet (expected for new environments)
- Playbook adherence may show 0% for cases without evaluator output
- Evidence tags may be empty if no evidence attached to case

### Edge Cases to Test
1. Submit form with minimal required fields → ✅ Should create case successfully
2. Navigate directly to workbench without case selected → ✅ Should show "Select a case" message
3. Filter by decision type with no cases → ✅ Should show empty state cleanly
4. Switch between decision types rapidly → ✅ Should not cause flashing or errors

---

## Success Criteria

### Must Pass All ✅ Checkpoints Above

**Critical Paths:**
1. All 4 decision types can submit forms and create cases
2. Console shows correct color-coded badges for all types
3. Evidence is attached and visible for all types
4. Explainability shows deterministic evaluator output
5. Workbench displays playbook adherence and actions
6. Coverage shows non-zero counts derived from actual data
7. Analytics dynamically supports all types without hardcoding

**Quality Indicators:**
- No TypeScript errors in build
- No runtime console errors
- No new dependencies added
- URL parameters sync correctly
- Saved views restore filters correctly
- All decision types render cleanly even with no data

---

## Quick Test Script (10 minutes)

1. **Submit one case per decision type** (4 cases, ~4 min)
2. **Check Console badges** (all 4 visible, ~1 min)
3. **Check Coverage page** (cycle through all types, ~2 min)
4. **Check Analytics** (verify breakdown includes all 4, ~2 min)
5. **Test decision type filter** (filter Console queue, ~1 min)

✅ **If all 5 steps pass, system is production-ready for manual testing**
