import { API_BASE } from '../lib/api';

const WORKFLOW_BASE = `${API_BASE}/workflow`;

export interface AttachmentItem {
  id: string;
  caseId: string;
  submissionId?: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy?: string | null;
  description?: string | null;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
  deleteReason?: string | null;
  isRedacted?: number;
  redactedAt?: string | null;
  redactedBy?: string | null;
  redactReason?: string | null;
  originalSha256?: string | null;
  createdAt: string;
}

export async function uploadAttachment(
  caseId: string,
  file: File,
  options?: { submissionId?: string; uploadedBy?: string; description?: string }
): Promise<AttachmentItem> {
  const form = new FormData();
  form.append('file', file);
  if (options?.submissionId) {
    form.append('submission_id', options.submissionId);
  }
  if (options?.uploadedBy) {
    form.append('uploaded_by', options.uploadedBy);
  }
  if (options?.description) {
    form.append('description', options.description);
  }

  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/attachments`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function listAttachments(
  caseId: string,
  options?: { includeDeleted?: boolean; includeRedacted?: boolean }
): Promise<AttachmentItem[]> {
  const params = new URLSearchParams();
  if (options?.includeDeleted) params.set('includeDeleted', 'true');
  if (options?.includeRedacted === false) params.set('includeRedacted', 'false');

  const url = params.toString()
    ? `${WORKFLOW_BASE}/cases/${caseId}/attachments?${params}`
    : `${WORKFLOW_BASE}/cases/${caseId}/attachments`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to list attachments: ${response.status}`);
  }
  const data = await response.json();
  return data.items || [];
}

export async function deleteAttachment(
  caseId: string,
  attachmentId: string,
  reason: string
): Promise<void> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Delete failed: ${response.status}`);
  }
}

export async function redactAttachment(
  caseId: string,
  attachmentId: string,
  reason: string
): Promise<void> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/attachments/${attachmentId}/redact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Redact failed: ${response.status}`);
  }
}

export function getAttachmentDownloadUrl(caseId: string, attachmentId: string): string {
  return `${WORKFLOW_BASE}/cases/${caseId}/attachments/${attachmentId}/download`;
}
