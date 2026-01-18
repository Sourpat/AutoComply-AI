# Phase 6.1 — Attachments (End-to-End)

## Overview
Implements attachments upload/list/download with persistent storage, metadata in SQLite, and timeline events.

## Backend
### Schema
- Table: `attachments`
  - `id`, `case_id`, `submission_id` (nullable)
  - `filename`, `content_type`, `size_bytes`
  - `storage_path`, `uploaded_by`, `description`
  - `created_at`

### Storage
- Files stored at `backend/app/data/uploads/{caseId}/...`
- Env override for tests: `ATTACHMENTS_UPLOAD_DIR`

### Endpoints
- `POST /workflow/cases/{caseId}/attachments`
  - `multipart/form-data` with `file` and optional `description`, `uploaded_by`, `submission_id`
- `GET /workflow/cases/{caseId}/attachments`
- `GET /workflow/cases/{caseId}/attachments/{attachmentId}/download`

### Events
- `attachment_added` (payload includes id, filename, uploadedBy, size)
- `attachment_downloaded`

### Validation
- Allowed types: PDF, JPEG, PNG
- Max size: 10 MB
- 404 if case not found
- 409 if cancelled

## Frontend
- Attachments tab supports upload (file picker + drag/drop), list, download.
- Shows success/error toasts.
- Disabled for resolved/cancelled cases.

## Tests
- Backend pytest: `backend/tests/test_attachments_flow.py`
- PowerShell: `test_phase6_attachments.ps1`

## Acceptance
- Upload persists after refresh
- Timeline shows `attachment_added`
- Download matches uploaded bytes
