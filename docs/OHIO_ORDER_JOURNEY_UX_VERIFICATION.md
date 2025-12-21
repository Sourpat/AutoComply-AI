# Ohio Hospital Order Journey UX Verification Guide

This document provides a comprehensive checklist for verifying that the Ohio Hospital Order Journey page meets all design and functional requirements for business users.

## Overview

The Ohio Hospital Order Journey page has been redesigned to be:
- **Business-friendly**: Clear labels, no jargon, obvious next actions
- **Demo-ready**: Professional visual hierarchy, WCAG-compliant contrast, cohesive styling
- **Self-explanatory**: Step-by-step guidance, status meanings, decision flow visualization

## Pre-Test Setup

**Start the application:**
```powershell
# Terminal 1 - Backend
cd backend
python -m src.main

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Navigate to the page:**
Open http://localhost:5173 and navigate to: **Sandboxes → Order Journeys → Ohio Hospital Order Journey**

---

## 1. Page Header & Instructions

### ✅ Visual Hierarchy
- [ ] Page title "End-to-End Order Journey" is bold and prominent
- [ ] "Ohio Hospital vertical" badge is visible next to the title
- [ ] "Show/Hide technical details" button is present and subtle (right-aligned)
- [ ] Description text is legible and informative

### ✅ "How this page works" Section
- [ ] Section has blue background (blue-50) with clear border
- [ ] Three numbered steps are displayed in a grid
- [ ] Each step has:
  - Blue circular number badge (1, 2, 3)
  - Bold step title ("Pick a scenario", "Run engines", "Review decision")
  - Brief description below the title
- [ ] All text is readable on the blue background (no low contrast)

---

## 2. Scenario Selection

### ✅ Scenario Cards
Test each scenario card:
- [ ] **Happy Path**: "Compliant CSF + Valid TDDD"
  - Short label: "Happy Path"
  - Expected outcome: "OK to ship"
  - Hover state shows border color change
- [ ] **Missing License**: "Valid CSF + Missing TDDD"
  - Short label: "Missing License"
  - Expected outcome: "Needs review or blocked"
- [ ] **Out of State**: "Non-Ohio Hospital (CSF Only)"
  - Short label: "Out of State"
  - Expected outcome: "OK to ship"

### ✅ Active State
- [ ] When a scenario is clicked, it shows:
  - Blue border (border-blue-500)
  - Blue background (bg-blue-50)
  - Blue ring (ring-2 ring-blue-200)
  - Blue text throughout the card
- [ ] Only ONE scenario card can be active at a time
- [ ] Inactive cards return to neutral grey styling

---

## 3. Error Handling

### ✅ Error Display
Test error scenarios (e.g., backend offline):
- [ ] Error section has red background (bg-red-50) with red border
- [ ] Warning icon (⚠) is visible
- [ ] Error title "Error running order journey" is bold and red (text-red-900)
- [ ] Error message is readable (text-red-700)

### ✅ Validation Errors
If a validation error occurs (422 response):
- [ ] "Show validation details" link is present and underlined
- [ ] Clicking the link expands a collapsible section
- [ ] Validation details are shown in a scrollable code block
- [ ] Details include field names and error messages

---

## 4. Final Decision Panel

### ✅ Visual Prominence
- [ ] Panel has thicker border (border-2) and shadow (shadow-md)
- [ ] "Final Decision" title is bold and clear
- [ ] Status badge is on the right side with colored background

### ✅ Status Colors & Labels
Test all three status types by running different scenarios:

**OK to Ship** (Happy Path scenario):
- [ ] Badge shows "OK to Ship" with green background (bg-emerald-100)
- [ ] Text is emerald-900 for high contrast
- [ ] "What this means": "Order can proceed without manual review."
- [ ] "Next action": "Proceed to fulfillment"

**Needs Review** (if applicable):
- [ ] Badge shows "Needs Review" with amber background (bg-amber-100)
- [ ] Text is amber-900 for high contrast
- [ ] "What this means": "Order requires compliance review before shipment."
- [ ] "Next action": "Submit to verification team"

**Blocked** (Missing License scenario, depending on data):
- [ ] Badge shows "Blocked" with red background (bg-red-100)
- [ ] Text is red-900 for high contrast
- [ ] "What this means": "Order cannot proceed until issues are fixed."
- [ ] "Next action": "Fix missing/invalid information then re-run"

### ✅ Content Sections
- [ ] "What this means" label is uppercase, grey, and small
- [ ] Meaning text is clear and non-technical
- [ ] "Next action" label uses same formatting
- [ ] Action text is bold and actionable
- [ ] If rationale is present, it's shown with "Reason" label

---

## 5. Decision Rollup Strip

### ✅ Visual Flow
- [ ] Section has gradient background (from-slate-50 to-white)
- [ ] Title "How the decision was made" is uppercase and small
- [ ] Flow shows: **Hospital CSF → + → Ohio TDDD → → Final**
- [ ] Each status badge uses appropriate color (emerald/amber/red)
- [ ] Arrow symbols (+ and →) are visible in grey (text-slate-400)

### ✅ Logic Verification
Run **Happy Path** scenario:
- [ ] Hospital CSF shows "OK to Ship" (green)
- [ ] Ohio TDDD shows "OK to Ship" (green)
- [ ] Final shows "OK to Ship" (green)

Run **Missing License** scenario:
- [ ] Hospital CSF shows status (likely green)
- [ ] Ohio TDDD shows negative status (red or amber)
- [ ] Final reflects the blocking issue

Run **Out of State** scenario:
- [ ] Hospital CSF shows status
- [ ] Ohio TDDD may not appear (not required for non-Ohio)
- [ ] Final shows appropriate decision

---

## 6. Engine Decision Cards

### ✅ Hospital CSF Engine Card
- [ ] Card has white background with subtle border
- [ ] Title "Hospital CSF Engine" is bold
- [ ] Status badge is displayed on the right
- [ ] "Rationale" section shows engine reasoning
- [ ] "Regulatory Evidence" section lists references:
  - Each reference has blue left border
  - Text is readable (text-slate-700)
  - References are properly formatted (label, citation, or ID)
- [ ] If missing fields exist, amber warning box is shown

### ✅ Ohio TDDD License Card
- [ ] Same layout as Hospital CSF card
- [ ] Title "Ohio TDDD License" is bold
- [ ] Status badge uses appropriate color
- [ ] Rationale and regulatory evidence displayed correctly
- [ ] If no TDDD evaluation ran (Out of State scenario):
  - [ ] Italic message: "No Ohio TDDD evaluation was run for this scenario."

---

## 7. Additional Notes Section

### ✅ Notes Display
- [ ] Section has light grey background (bg-slate-50)
- [ ] Title "Additional Notes" is bold
- [ ] Notes are displayed as bulleted list (list-disc)
- [ ] Each note is on its own line with proper spacing
- [ ] Text is readable (text-slate-700)

---

## 8. Under the Hood (Developer Trace)

### ✅ Toggle Behavior
- [ ] Section is HIDDEN by default
- [ ] Clicking "Show technical details" button in header toggles visibility
- [ ] When shown, section appears with grey background (bg-slate-50) and border

### ✅ Copy Buttons
- [ ] Three buttons are displayed:
  - "Copy request JSON" (blue background)
  - "Copy response JSON" (blue background)
  - "Copy as cURL" (dark grey background)
- [ ] Clicking a button copies content to clipboard
- [ ] Success message appears: "Request JSON copied to clipboard." (green text)
- [ ] Message disappears after 2 seconds

### ✅ Payload Viewers
- [ ] "Request payload" is in a collapsible `<details>` element (collapsed by default)
- [ ] "Response payload" is in a collapsible `<details>` element (collapsed by default)
- [ ] Clicking summary expands the JSON code
- [ ] JSON is displayed in dark code block (bg-slate-800)
- [ ] Code is syntax-highlighted and properly formatted
- [ ] Horizontal scrolling works for long lines

---

## 9. Contrast & Accessibility

### ✅ WCAG Compliance
Check all text/background combinations:
- [ ] No green text on green background
- [ ] No low-contrast cyan pills on dark backgrounds
- [ ] Scenario pills: Blue-50 background with blue-900 text (✅ sufficient contrast)
- [ ] Status badges: All use X-100 backgrounds with X-900 text for WCAG AA compliance
- [ ] Error section: Red-50 background with red-900 title and red-700 body
- [ ] Code blocks: Slate-800 background with slate-100 text

### ✅ Hover States
- [ ] All buttons have visible hover states (color change or underline)
- [ ] Scenario cards darken borders on hover (border-slate-400)
- [ ] Copy buttons darken on hover (e.g., bg-blue-700)
- [ ] Summary elements show pointer cursor

---

## 10. End-to-End Scenarios

### ✅ Test Case 1: Happy Path
1. Click **Happy Path** scenario
2. Wait for API response
3. Verify:
   - [ ] Final Decision shows "OK to Ship" (green)
   - [ ] Decision Rollup shows CSF + TDDD → Final (all green)
   - [ ] Hospital CSF card shows rationale and references
   - [ ] Ohio TDDD card shows rationale and references
   - [ ] No missing fields warnings
   - [ ] Notes section appears if backend returns notes

### ✅ Test Case 2: Missing License
1. Click **Missing License** scenario
2. Wait for API response
3. Verify:
   - [ ] Final Decision shows "Needs Review" or "Blocked" (amber/red)
   - [ ] Decision Rollup shows negative TDDD status
   - [ ] Ohio TDDD card explains the missing/invalid license issue
   - [ ] Missing fields warning may appear
   - [ ] "Next action" tells user what to do

### ✅ Test Case 3: Out of State
1. Click **Out of State** scenario
2. Wait for API response
3. Verify:
   - [ ] Final Decision shows "OK to Ship" (green)
   - [ ] Decision Rollup may skip TDDD (not required)
   - [ ] Hospital CSF card shows compliant status
   - [ ] Ohio TDDD card either shows "not run" message or is skipped
   - [ ] Notes explain why TDDD wasn't required

---

## 11. Responsive Design

### ✅ Desktop (> 768px)
- [ ] "How this page works" displays in 3 columns
- [ ] Scenario selection displays in 3 columns
- [ ] Engine decision cards display in 2 columns side-by-side

### ✅ Tablet/Mobile (< 768px)
- [ ] "How this page works" stacks vertically
- [ ] Scenario cards stack vertically
- [ ] Engine decision cards stack vertically
- [ ] All text remains readable
- [ ] Touch targets are large enough (buttons, scenario cards)

---

## 12. Performance & Loading States

### ✅ Loading Behavior
- [ ] When a scenario is clicked, card shows disabled state
- [ ] Button text or UI indicates loading (opacity-50 on disabled buttons)
- [ ] No double-clicking allowed during API call
- [ ] On success, results render smoothly
- [ ] On error, error section appears immediately

---

## Success Criteria Summary

✅ **Business-Friendly UX**
- Clear, non-technical language throughout
- Obvious next actions for each status
- Self-explanatory flow (stepper → scenarios → results)

✅ **Demo-Ready Visuals**
- Professional typography and spacing
- Consistent Tailwind component styling
- WCAG-compliant contrast ratios
- No cluttered or low-contrast UI elements

✅ **Functional Completeness**
- All three scenarios run successfully
- Error handling is graceful and informative
- Under-the-hood section works for technical users
- Responsive on all screen sizes

---

## Troubleshooting

### Issue: Backend not responding
**Solution**: Ensure backend is running on port 8000. Check terminal logs for errors.

### Issue: 422 Validation errors
**Solution**: Check [orderMockApprovalClient.ts](../frontend/src/api/orderMockApprovalClient.ts) payload mapping. Ensure `facility_name`, `pharmacy_license_number`, and `controlled_substances` structure matches backend `HospitalCsfForm` model.

### Issue: Blank page or rendering errors
**Solution**: Check browser console for React errors. Ensure all imports are correct and no circular dependencies exist.

---

## Related Files

- **Component**: [OhioHospitalOrderJourneyCard.tsx](../frontend/src/components/OhioHospitalOrderJourneyCard.tsx)
- **API Client**: [orderMockApprovalClient.ts](../frontend/src/api/orderMockApprovalClient.ts)
- **Backend Endpoint**: `POST /orders/mock/ohio-hospital-approval`
- **Backend Test**: [test_order_mock_approval_api.py](../backend/tests/test_order_mock_approval_api.py)

---

**Last Updated**: March 2024  
**Verified By**: _[Your Name/Team]_  
**Status**: ✅ Ready for QA
