import { API_BASE } from '../lib/api';

const WORKFLOW_BASE = `${API_BASE}/workflow`;

export interface EvidenceUploadItem {
  id: string;
  caseId: string;
  submissionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  sha256?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
}

export async function uploadEvidence(
  caseId: string,
  submissionId: string,
  file: File,
  uploadedBy?: string
): Promise<EvidenceUploadItem> {
  const form = new FormData();
  form.append('file', file);
  form.append('submission_id', submissionId);
  if (uploadedBy) {
    form.append('uploaded_by', uploadedBy);
  }

  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/evidence`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function listEvidence(caseId: string): Promise<EvidenceUploadItem[]> {
  const response = await fetch(`${WORKFLOW_BASE}/cases/${caseId}/evidence`);
  if (!response.ok) {
    throw new Error(`Failed to list evidence: ${response.status}`);
  }
  const data = await response.json();
  return data.items || [];
}

export function getEvidenceDownloadUrl(evidenceId: string): string {
  return `${WORKFLOW_BASE}/evidence/${evidenceId}/download`;
}
