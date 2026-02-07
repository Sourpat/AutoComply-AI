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

export async function createSubmitterSubmission(
  payload: SubmitterSubmissionRequest
): Promise<SubmitterSubmissionResponse> {
  return apiFetch<SubmitterSubmissionResponse>("/api/submitter/submissions", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
}
