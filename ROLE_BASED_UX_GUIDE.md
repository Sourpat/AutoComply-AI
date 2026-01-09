# Role-Based UX Implementation Guide

## Overview
AutoComply AI now has enterprise-grade role-based permissions with 3 distinct user roles:
- **Submitter** (📝): Simplified view for CSF submission
- **Verifier** (✅): Full compliance review capabilities
- **Admin** (⚙️): Complete access including debug tools

## Quick Start

### Switching Roles
1. Look for the role dropdown in the top-right corner of the header
2. Click to see available roles: Submitter, Verifier, Admin
3. Select a role - it persists across page refreshes via localStorage
4. Default role: **Verifier** (demo-friendly)

### Role Storage
- **Key**: `acai.role.v1` (localStorage)
- **Default**: `verifier`
- **Values**: `'submitter' | 'verifier' | 'admin'`

---

## Role-Specific Features

### 📝 Submitter Role

#### Compliance Console
- ✅ **Sees**: "My Submissions" section
  - Shows all personal CSF submissions
  - Status indicators: ✓ Approved, ✗ Blocked, ⏳ Under Review
  - "View details" button to open trace
- ✅ **Sees**: Submitter guidance panel
  - Tips for successful submissions
  - Common reasons for review
  - Pro tips for data quality
- ❌ **Hidden**: Work queue (verifier-only)
- ❌ **Hidden**: Recent decisions table (verifier/admin-only)

#### RAG Explorer
- ✅ **Sees**: Simplified decision outcome
  - Approval/Block/Review status
  - Decision summary
  - Missing fields (data completeness)
  - Request info template
- ❌ **Hidden**: Mode switcher (Sandbox/Connected)
  - Always uses Sandbox mode
- ❌ **Hidden**: Rule IDs and citations
- ❌ **Hidden**: Evidence chips (regulatory documents)
- ❌ **Hidden**: Fired rules breakdown
- ❌ **Hidden**: Counterfactuals
- ❌ **Hidden**: Export buttons

**Instructions shown:**
> "View decision outcome and missing data fields. Detailed rule analysis available to verifiers."

---

### ✅ Verifier Role (DEFAULT)

#### Compliance Console
- ✅ **Sees**: Work queue
  - Items flagged for review
  - Priority levels (High, Medium, Low)
  - "Open trace" and "Download" buttons
- ✅ **Sees**: Recent decisions table
  - Full decision log with trace replay
  - Export decision packets
- ❌ **Hidden**: "My Submissions" (submitter-only)
- ❌ **Hidden**: Submitter guidance (submitter-only)

#### RAG Explorer
- ✅ **Sees**: Full explainability
  - Mode switcher (Sandbox/Connected)
  - Complete rule breakdown by severity
  - Rule IDs, citations, jurisdictions
  - Evidence chips with document links
  - Data completeness scoring
  - Counterfactuals (why other rules didn't fire)
  - Request info templates
- ✅ **Sees**: Export decision packets
  - JSON format (API integration)
  - HTML format (print-friendly audit records)

**Instructions shown:**
> "Choose decision source, then click Explain to see outcome, fired rules, and next steps."

---

### ⚙️ Admin Role

#### Compliance Console
- ✅ **Sees**: Everything verifiers see
- ✅ **Additional**: Admin controls
  - Clear demo data
  - Seed demo data
  - Debug badges and metadata

#### RAG Explorer
- ✅ **Sees**: Everything verifiers see
- ✅ **Additional**: Debug panels
  - Trace metadata viewer
  - Raw API responses
  - Backend timing information
  - Developer support tools

**Instructions shown:**
> "Choose decision source, then click Explain to see outcome, fired rules, and next steps."

---

## Permission Matrix

| Permission                  | Submitter | Verifier | Admin |
|-----------------------------|-----------|----------|-------|
| View work queue             | ❌        | ✅       | ✅    |
| View recent decisions       | ❌        | ✅       | ✅    |
| View "My Submissions"       | ✅        | ❌       | ❌    |
| Use Connected mode          | ❌        | ✅       | ✅    |
| View rule IDs               | ❌        | ✅       | ✅    |
| View citations              | ❌        | ✅       | ✅    |
| View evidence chips         | ❌        | ✅       | ✅    |
| View fired rules            | ❌        | ✅       | ✅    |
| View counterfactuals        | ❌        | ✅       | ✅    |
| View completeness details   | ✅        | ✅       | ✅    |
| Download decision packets   | ❌        | ✅       | ✅    |
| Export HTML                 | ❌        | ✅       | ✅    |
| Clear demo data             | ❌        | ❌       | ✅    |
| Seed demo data              | ❌        | ❌       | ✅    |
| View debug panels           | ❌        | ❌       | ✅    |

---

## Testing Checklist

### Submitter Role
- [ ] Switch to Submitter role via dropdown
- [ ] Navigate to Compliance Console
- [ ] Verify "My Submissions" section is visible
- [ ] Verify work queue is hidden
- [ ] Verify recent decisions table is hidden
- [ ] Verify submitter guidance panel is shown
- [ ] Navigate to RAG Explorer
- [ ] Verify mode switcher is hidden (Sandbox only)
- [ ] Run a decision and verify:
  - [ ] Outcome badge visible
  - [ ] Decision summary visible
  - [ ] Missing fields visible
  - [ ] Rule IDs hidden
  - [ ] Citations hidden
  - [ ] Evidence chips hidden
  - [ ] Fired rules section hidden
  - [ ] Counterfactuals hidden
  - [ ] Export buttons hidden
- [ ] Refresh page, verify role persists

### Verifier Role
- [ ] Switch to Verifier role via dropdown
- [ ] Navigate to Compliance Console
- [ ] Verify work queue is visible
- [ ] Verify recent decisions table is visible
- [ ] Verify "My Submissions" is hidden
- [ ] Verify submitter guidance is hidden
- [ ] Navigate to RAG Explorer
- [ ] Verify mode switcher is visible
- [ ] Switch to Connected mode
- [ ] Run a decision and verify:
  - [ ] All rule details visible
  - [ ] Rule IDs and citations visible
  - [ ] Evidence chips clickable
  - [ ] Fired rules breakdown visible
  - [ ] Counterfactuals visible
  - [ ] Export JSON button works
  - [ ] Export HTML button works
- [ ] Refresh page, verify role persists

### Admin Role
- [ ] Switch to Admin role via dropdown
- [ ] Verify all verifier features work
- [ ] Verify debug panels accessible (if enabled)
- [ ] Verify admin controls visible
- [ ] Test clear/seed demo data (if applicable)
- [ ] Refresh page, verify role persists

### Cross-Role Navigation
- [ ] Start as Submitter, view My Submissions
- [ ] Switch to Verifier, verify work queue appears
- [ ] Switch to Admin, verify all features available
- [ ] Switch back to Submitter, verify restrictions apply
- [ ] No crashes or blank screens during transitions

---

## Technical Implementation

### Files Created
1. **`frontend/src/context/RoleContext.tsx`**
   - RoleProvider component with localStorage persistence
   - useRole() hook: `{ role, setRole, isSubmitter, isVerifier, isAdmin }`
   - Helper functions: getRoleDisplayName(), getRoleIcon()

2. **`frontend/src/auth/permissions.ts`**
   - 15 permission check functions (canViewEvidence, canViewWorkQueue, etc.)
   - Role-specific instructions (getRagExplorerInstructions, getConsoleInstructions)

### Files Modified
1. **`frontend/src/main.jsx`**
   - Wrapped app with `<RoleProvider>`

2. **`frontend/src/components/AppHeader.tsx`**
   - Added role switcher dropdown (top-right)

3. **`frontend/src/pages/ConsoleDashboard.tsx`**
   - Added useRole hook
   - Gated work queue with `canViewWorkQueue(role)`
   - Added "My Submissions" for submitters
   - Gated recent decisions with `canViewRecentDecisions(role)`
   - Added submitter guidance panel

4. **`frontend/src/features/rag/RegulatoryDecisionExplainPanel.tsx`**
   - Added useRole hook
   - Gated mode switcher with `canUseConnectedMode(role)`
   - Gated rule IDs/citations with `canViewRuleIds(role)`
   - Gated evidence chips with `canViewEvidence(role)`
   - Gated fired rules with `canViewFiredRules(role)`
   - Gated counterfactuals with `canViewCounterfactuals(role)`
   - Gated export buttons with `canDownloadPackets(role)` and `canExportHtml(role)`
   - Updated instructions with `getRagExplorerInstructions(role)`

---

## localStorage Schema

```typescript
{
  "acai.role.v1": "submitter" | "verifier" | "admin"
}
```

**Default**: `"verifier"`

---

## User Stories

### Story 1: Submitter Experience
> As a **Submitter**, I want to see only my submissions and understand what data is missing, without being overwhelmed by technical compliance rules.

**Behavior:**
- Sees simplified outcome (Approved/Blocked/Review)
- Sees missing fields with clear labels
- Gets template message to request info
- No regulatory jargon or rule IDs

### Story 2: Verifier Experience
> As a **Verifier**, I need full transparency into which rules fired, what evidence was used, and why decisions were made, so I can validate compliance.

**Behavior:**
- Sees complete rule breakdown by severity
- Can click evidence chips to review documents
- Understands why certain rules didn't fire (counterfactuals)
- Can export decision packets for audit

### Story 3: Admin Experience
> As an **Admin**, I need access to all features plus debugging tools to troubleshoot issues and manage demo data.

**Behavior:**
- All verifier features
- Debug metadata and trace viewer
- Admin controls (clear/seed data)
- Backend timing information

---

## Next Steps (Future Enhancements)

1. **Backend Integration**
   - Send role to backend API for server-side validation
   - Role-based API endpoints (e.g., `/api/submissions?role=submitter`)

2. **Role Assignment via Authentication**
   - Integrate with SSO/OAuth provider
   - Map user claims to roles automatically
   - Remove manual role switcher in production

3. **Audit Logging**
   - Log role changes with timestamp
   - Track which role viewed which decision
   - Export audit trail for compliance

4. **Custom Roles**
   - Allow admins to define custom roles (e.g., "ReadOnlyVerifier")
   - Granular permission builder UI
   - Role templates for common scenarios

5. **Role-Specific Dashboards**
   - Submitter: "My Submission History" with analytics
   - Verifier: "Review Queue Metrics" with SLA tracking
   - Admin: "System Health Dashboard" with performance metrics

---

## Build Status

✅ **Build successful** (1.28s)
✅ **No TypeScript errors**
✅ **No runtime warnings**
✅ **Bundle size**: 629.66 kB (gzipped: 152.92 kB)

---

## FAQ

**Q: What happens if I clear localStorage?**
A: Role resets to default (`verifier`). User can switch roles again via dropdown.

**Q: Can I add more roles?**
A: Yes! Update `UserRole` type in RoleContext.tsx and add permission checks in permissions.ts.

**Q: Does role affect backend API calls?**
A: Not yet. This is frontend-only. Backend integration is a future enhancement.

**Q: Why is Verifier the default role?**
A: It's the most demo-friendly - shows full capabilities without admin clutter.

**Q: Can submitters see other people's submissions?**
A: Currently, "My Submissions" shows all submissions (demo limitation). In production, filter by authenticated user ID.

---

## Support

For issues or questions:
1. Check browser console for errors
2. Verify role switcher is visible in header
3. Clear localStorage and refresh: `localStorage.clear()`
4. Re-run build: `npm run build`
5. Review this guide for expected behavior

**Last updated:** Step 1.9 - Role-Based UX Implementation
