# Admin Access Guide

**Private Documentation - For Interview/Demo Use Only**

This document describes how to unlock admin features in the AutoComply AI application. These features are hidden from public portfolio viewers (recruiters) and only accessible when admin mode is enabled.

---

## Admin-Only Features

When admin mode is **unlocked**, you get access to:

### Frontend

1. **Console Tour** - Guided tour with narrative explanations of the compliance console
2. **Review Queue** - Human-in-the-loop review queue for unanswered compliance questions
3. **Ops Dashboard** - Operational metrics and KPIs for the verification team
4. **Testing & Reliability Card** - Documentation of test coverage and reliability practices
5. **Future Work Card** - Product roadmap and next steps for the platform
6. **Integrations Card** - n8n workflow integration examples
7. **Run Locally Card** - Instructions for running the demo locally
8. **Docs & Links Card** - Quick access to repo, architecture docs, and case studies

### Backend

1. **Review Queue API** (`/api/v1/admin/review-queue`) - Manage review items, assign reviewers, approve answers
2. **Ops Dashboard API** (`/api/v1/admin/ops`) - Read-only metrics and analytics
3. **KB Admin API** (`/api/v1/admin/kb`) - Seed and manage knowledge base entries
4. **Admin Operations** (`/admin/*`) - Dangerous operations like database reset (dev/test only)

---

## How to Enable Admin Mode

Admin mode is controlled by a **localStorage flag** in the browser. The app checks for this flag to determine whether to show admin features.

### Option 1: Admin Login Page

1. Navigate to: `http://your-frontend-url/admin/login`
2. Enter the passcode: `autocomply-admin-2024`
3. Click "Unlock Admin Features"
4. Admin mode will be enabled for the current browser session

### Option 2: Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run: `localStorage.setItem('admin_unlocked', 'true')`
4. Refresh the page
5. Admin features will now be visible

### Option 3: URL Parameter

1. Navigate to Console page with admin param: `/console?admin=true`
2. Admin mode will be enabled automatically
3. You can then use the "Enable Admin" button to toggle it

---

## Admin Mode Behavior

### Frontend Implementation

- **State**: Stored in `localStorage` as `admin_unlocked` = `'true'`
- **Helper**: `isAdminUnlocked()` function checks the localStorage flag
- **Auth Headers**: `X-User-Role: admin` header sent to backend when admin unlocked
- **Protected Routes**: `ProtectedAdminRoute` component prevents access to admin pages
- **Conditional Rendering**: UI elements wrapped in `{isAdmin && <Component />}`

### Backend Implementation

- **Auth Dependency**: `require_admin_role()` dependency checks `X-User-Role` header
- **Router Guards**: Admin routers use `dependencies=[Depends(require_admin_role)]`
- **403 Response**: Returns `{"error": "admin_access_required"}` if role != 'admin'
- **CORS**: Production must set exact frontend URL in `CORS_ORIGINS` env var

---

## Security Notes

### Production Deployment

1. **CORS Hardening**: Set `CORS_ORIGINS` to exact frontend URL
   ```bash
   # Example
   CORS_ORIGINS=https://your-frontend.onrender.com
   ```

2. **Backend Validation**: All admin endpoints require `X-User-Role: admin` header

3. **Frontend Gating**: Admin UI elements only render when `admin_unlocked === 'true'`

4. **No Wildcards**: Never use `CORS_ORIGINS=*` in production

### Why This Approach?

This is a **portfolio/demo security pattern** designed to:
- Hide internal tools and admin features from recruiters
- Keep tour narrative and demo content private for interview discussions
- Prevent docs/architecture explanations from appearing in public UI
- Allow easy unlock during interviews, demos, and portfolio reviews

**This is NOT production-grade authentication.** For a real production system, you would implement:
- Backend JWT tokens with role-based access control (RBAC)
- Database-backed user accounts with hashed passwords
- Session management and refresh tokens
- OAuth2 / OIDC integration
- Audit logging of admin actions

---

## Disabling Admin Mode

### Browser Console
```javascript
localStorage.removeItem('admin_unlocked');
// Then refresh the page
```

### Admin Button
- Click "Disable Admin" button in Console page header
- Admin mode will be disabled and page will reload

---

## Interview Talking Points

When demoing admin features:

1. **Human-in-the-Loop Review**
   - "AutoComply can escalate unknown questions to human reviewers"
   - "Review Queue allows experts to draft answers, approve, and publish to KB"
   - "Demonstrates hybrid AI + human oversight pattern"

2. **Ops Dashboard**
   - "Verification teams need operational visibility into queue health"
   - "Real-time KPIs: open reviews, high-risk items, response times"
   - "Production-ready monitoring and SLA tracking"

3. **Testing & Reliability**
   - "Pytest suite with ~20 test cases covering CSF engines, licenses, RAG"
   - "Smoke tests for critical paths (Hospital CSF, Practitioner CSF, Ohio TDDD)"
   - "Test coverage badge in docs shows commitment to quality"

4. **Security Hardening**
   - "Admin features gated behind localStorage flag for portfolio hosting"
   - "Backend endpoints validate X-User-Role header"
   - "CORS restricted to exact frontend URL in production"

---

## Common Issues

### Admin Nav Not Showing
- Check localStorage: `localStorage.getItem('admin_unlocked')`
- Refresh page after setting flag
- Clear browser cache if stale

### 403 Errors on Admin Endpoints
- Verify `X-User-Role: admin` header is being sent
- Check Network tab in DevTools
- Ensure `getAuthHeaders()` is used in API client

### Tour/Docs Still Visible
- Check `isAdmin` state in ComplianceConsolePage
- Verify conditional rendering: `{isAdmin && <Component />}`
- Hard refresh (Ctrl+Shift+R) to clear cached components

---

## Files Modified for Admin Hardening

### Backend
- `backend/src/api/dependencies/auth.py` - Admin role dependency
- `backend/src/api/routes/admin_review.py` - Review queue auth
- `backend/src/api/routes/ops.py` - Ops dashboard auth
- `backend/src/api/routes/kb_admin.py` - KB admin auth
- `backend/src/api/main.py` - CORS hardening comments
- `backend/src/config.py` - CORS production warnings

### Frontend
- `frontend/src/pages/ComplianceConsolePage.tsx` - Gated demo content
- `frontend/src/components/AppHeader.tsx` - Admin nav gating (existing)
- `frontend/src/lib/authHeaders.ts` - X-User-Role header logic (existing)

---

## For Production Deployment

When deploying to Render, Vercel, or other platforms:

1. **Set CORS_ORIGINS**: Use exact frontend URL
   ```
   CORS_ORIGINS=https://autocomply-frontend.onrender.com
   ```

2. **Verify Admin Endpoints**: Test that 403 is returned without admin header
   ```bash
   curl -X GET https://api.example.com/api/v1/admin/ops/kpis
   # Should return 403: {"error": "admin_access_required"}
   ```

3. **Test Public UI**: Visit frontend without admin unlock
   - Should NOT see: Review Queue, Ops Dashboard, Tour, Docs cards
   - Should see: Chat, CSF forms, License validation, Console

4. **Test Admin Unlock**: Use `/admin/login` page
   - Enter passcode
   - Verify admin features appear
   - Check browser DevTools for X-User-Role header

---

## Summary

**For Recruiters (Admin Mode OFF):**
- Clean, production-ready compliance platform
- Chat interface, CSF forms, license validation
- No internal tools or demo narrative visible

**For Interviews (Admin Mode ON):**
- Full access to Review Queue, Ops Dashboard, Tour
- Demo content, testing docs, architecture explanations
- Portfolio storytelling and technical deep-dives

This ensures recruiters see a polished product while preserving your ability to showcase the full technical depth during interviews.

---

*Last Updated: 2024-12-28*  
*AutoComply AI - Portfolio Edition*
