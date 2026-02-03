// frontend/src/api/consoleClient.ts
import { apiFetch } from "../lib/api";
import { getAuthHeaders, getJsonHeaders } from "../lib/authHeaders";

const CONSOLE_BASE = "/api/console";

export interface WorkQueueSubmission {
  submission_id: string;
  csf_type: string;
  tenant: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  title: string;
  subtitle: string;
  summary: string | null;
  trace_id: string;
  payload: Record<string, unknown>;
  decision_status: string | null;
  risk_level: string | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface WorkQueueResponse {
  items: WorkQueueSubmission[];
  statistics: Record<string, unknown>;
  total: number;
}

export interface UpdateSubmissionRequest {
  status?: "submitted" | "in_review" | "approved" | "rejected";
  reviewer_notes?: string;
  reviewed_by?: string;
}

export async function getWorkQueue(
  tenant?: string,
  status?: string,
  limit: number = 100
): Promise<WorkQueueResponse> {
  const params = new URLSearchParams();
  if (tenant) params.append("tenant", tenant);
  if (status) params.append("status", status);
  params.append("limit", limit.toString());
  return apiFetch<WorkQueueResponse>(`${CONSOLE_BASE}/work-queue?${params}`, {
    headers: getAuthHeaders(),
  });
}

export async function updateSubmission(
  submissionId: string,
  update: UpdateSubmissionRequest
): Promise<WorkQueueSubmission> {
  return apiFetch<WorkQueueSubmission>(`${CONSOLE_BASE}/work-queue/${submissionId}`, {
    method: "PATCH",
    headers: getJsonHeaders(),
    body: JSON.stringify(update),
  });
}
