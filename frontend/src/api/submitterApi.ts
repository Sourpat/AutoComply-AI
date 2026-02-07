import { apiFetch } from "../lib/api";
import { getJsonHeaders } from "../lib/authHeaders";

export type SubmitterAttachment = {
  name: string;
  content_type?: string | null;
  size_bytes?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type SubmitterSubmissionRequest = {
  submission_id?: string;
  client_token?: string;
  subject?: string;
  submitter_name?: string;
  jurisdiction?: string;
  doc_type?: string;
  notes?: string;
  attachments?: SubmitterAttachment[];
};

export type SubmitterSubmissionResponse = {
  submission_id: string;
  verifier_case_id: string;
  status: string;
};

export type SubmitterRequestInfo = {
  message?: string | null;
  requested_at?: string | null;
  requested_by?: string | null;
};

export type SubmitterSubmissionDetail = {
  submission_id: string;
  csf_type: string;
  tenant: string;
  status: string;
  last_status_at?: string | null;
  last_status_by?: string | null;
  request_info?: SubmitterRequestInfo | null;
  title: string;
  subtitle: string;
  summary?: string | null;
  trace_id: string;
  payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SubmitterEvent = {
  id: string;
  submission_id: string;
  case_id?: string | null;
  actor_type: string;
  actor_id?: string | null;
  event_type: string;
  title: string;
  message?: string | null;
  payload_json?: string | null;
  created_at: string;
};

export async function createSubmitterSubmission(
  payload: SubmitterSubmissionRequest
): Promise<SubmitterSubmissionResponse> {
  return apiFetch<SubmitterSubmissionResponse>("/api/submitter/submissions", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function fetchSubmitterSubmissions(params?: {
  status?: string;
  limit?: number;
}): Promise<SubmitterSubmissionDetail[]> {
  const search = new URLSearchParams();
  if (params?.status) {
    search.set("status", params.status);
  }
  if (params?.limit) {
    search.set("limit", params.limit.toString());
  }
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<SubmitterSubmissionDetail[]>(`/api/submitter/submissions${suffix}`, {
    headers: getJsonHeaders(),
  });
}

export async function fetchSubmitterSubmission(
  submissionId: string
): Promise<SubmitterSubmissionDetail> {
  return apiFetch<SubmitterSubmissionDetail>(`/api/submitter/submissions/${submissionId}`, {
    headers: getJsonHeaders(),
  });
}

export async function respondToSubmitterSubmission(
  submissionId: string,
  payload: { message?: string | null }
): Promise<SubmitterSubmissionDetail> {
  return apiFetch<SubmitterSubmissionDetail>(
    `/api/submitter/submissions/${submissionId}/respond`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchSubmitterSubmissionEvents(
  submissionId: string,
  limit: number = 50
): Promise<SubmitterEvent[]> {
  return apiFetch<SubmitterEvent[]>(
    `/api/submitter/submissions/${submissionId}/events?limit=${limit}`,
    {
      headers: getJsonHeaders(),
    }
  );
}
