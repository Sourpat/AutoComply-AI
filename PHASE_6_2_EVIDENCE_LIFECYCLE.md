# Phase 6.2 — Attachment Lifecycle (Removal/Redaction)

## Overview
Adds attachment removal and redaction controls with audit and timeline events.

## Backend
### Schema Updates
`attachments` table adds:
- `is_deleted`, `deleted_at`, `deleted_by`, `delete_reason`
- `is_redacted`, `redacted_at`, `redacted_by`, `redact_reason`
- `original_sha256`

### Endpoints
- `DELETE /workflow/cases/{caseId}/attachments/{attachmentId}`
  - Body: `{ "reason": "..." }`
  - Soft delete, emits `attachment_removed` case event
  - Audit event: `evidence_removed`
- `POST /workflow/cases/{caseId}/attachments/{attachmentId}/redact`
  - Body: `{ "reason": "..." }`
  - Marks redacted, blocks download, emits `attachment_redacted`
  - Audit event: `evidence_redacted`
- `GET /workflow/cases/{caseId}/attachments`
  - Default: excludes deleted, includes redacted
  - Query: `includeDeleted=true` (admin only), `includeRedacted=false`
- Download behavior:
  - Deleted: 410
  - Redacted: 451

### Audit Logging
All audit events include non-null messages.

## Frontend
- Attachments tab includes Remove/Redact actions with reason modal.
- Redacted attachments show badge and disable download.

## Tests
- Backend: `backend/tests/test_attachments_lifecycle.py`
- PowerShell: `test_phase6_2_attachment_lifecycle.ps1`
