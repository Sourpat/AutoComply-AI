// frontend/src/api/verifierCasesClient.ts
import { apiFetch, API_BASE } from "../lib/api";
import { getAuthHeaders, getJsonHeaders } from "../lib/authHeaders";

const VERIFIER_BASE = "/api/verifier";

export type VerifierCase = {
  case_id: string;
  submission_id: string | null;
  status: string;
  submission_status?: string | null;
  request_info?: {
    message?: string | null;
    requested_at?: string | null;
    requested_by?: string | null;
  } | null;
  jurisdiction: string | null;
  assignee: string | null;
  assigned_at: string | null;
  locked: boolean;
  decision: {
    type: "approve" | "reject" | "request_info";
    reason?: string | null;
    actor?: string | null;
    timestamp?: string | null;
    version?: string | null;
  } | null;
  submission_summary?: {
    submitter_name?: string | null;
    created_at?: string | null;
    notes_count?: number | null;
    attachment_count?: number | null;
  } | null;
  created_at: string;
  updated_at: string;
  summary: string;
};

export type VerifierCaseEvent = {
  id: number;
  case_id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
};

export type VerifierNote = {
  id: number;
  case_id: string;
  note: string;
  actor: string | null;
  created_at: string;
};

export type VerifierCasesResponse = {
  items: VerifierCase[];
  limit: number;
  offset: number;
  count: number;
};

export type VerifierCaseDetail = {
  case: VerifierCase;
  events: VerifierCaseEvent[];
  notes: VerifierNote[];
};

export type VerifierCaseActionRequest = {
  action: "approve" | "reject" | "needs_review";
  actor?: string;
  reason?: string;
};

export type VerifierDecisionRequest = {
  type: "approve" | "reject" | "request_info";
  reason?: string;
  actor?: string;
};

export type VerifierCaseActionResponse = {
  case: VerifierCase;
  event: VerifierCaseEvent;
};

export type VerifierCaseAssignmentRequest = {
  assignee: string | null;
  actor?: string;
};

export type VerifierCaseNoteRequest = {
  note: string;
  actor?: string;
};

export type VerifierCaseNoteResponse = {
  note: VerifierNote;
  event: VerifierCaseEvent;
};

export async function fetchVerifierCases(params: {
  limit: number;
  offset: number;
  status?: string;
  jurisdiction?: string;
  assignee?: string;
  submission_status?: string;
}): Promise<VerifierCasesResponse> {
  const search = new URLSearchParams({
    limit: params.limit.toString(),
    offset: params.offset.toString(),
  });

  if (params.status) {
    search.set("status", params.status);
  }

  if (params.jurisdiction) {
    search.set("jurisdiction", params.jurisdiction);
  }

  if (params.assignee) {
    search.set("assignee", params.assignee);
  }

  if (params.submission_status) {
    search.set("submission_status", params.submission_status);
  }

  return apiFetch<VerifierCasesResponse>(`${VERIFIER_BASE}/cases?${search.toString()}`, {
    headers: getAuthHeaders(),
  });
}

export async function fetchVerifierCaseDetail(caseId: string): Promise<VerifierCaseDetail> {
  return apiFetch<VerifierCaseDetail>(`${VERIFIER_BASE}/cases/${caseId}`, {
    headers: getAuthHeaders(),
  });
}

export async function postVerifierCaseAction(
  caseId: string,
  payload: VerifierCaseActionRequest
): Promise<VerifierCaseActionResponse> {
  return apiFetch<VerifierCaseActionResponse>(`${VERIFIER_BASE}/cases/${caseId}/actions`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function setVerifierCaseAssignment(
  caseId: string,
  payload: VerifierCaseAssignmentRequest
): Promise<VerifierCase> {
  return apiFetch<VerifierCase>(`${VERIFIER_BASE}/cases/${caseId}/assignment`, {
    method: "PATCH",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function postVerifierCaseNote(
  caseId: string,
  payload: VerifierCaseNoteRequest
): Promise<VerifierCaseNoteResponse> {
  return apiFetch<VerifierCaseNoteResponse>(`${VERIFIER_BASE}/cases/${caseId}/notes`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function decideVerifierCase(
  caseId: string,
  payload: VerifierDecisionRequest,
  includeExplain: boolean = true
): Promise<VerifierCase> {
  const flag = includeExplain ? 1 : 0;
  return apiFetch<VerifierCase>(`${VERIFIER_BASE}/cases/${caseId}/decision?include_explain=${flag}`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function getFinalPacket(caseId: string): Promise<any> {
  return apiFetch<any>(`${VERIFIER_BASE}/cases/${caseId}/final-packet`, {
    headers: getAuthHeaders(),
  });
}

export async function fetchVerifierCaseEvents(caseId: string): Promise<VerifierCaseEvent[]> {
  return apiFetch<VerifierCaseEvent[]>(`${VERIFIER_BASE}/cases/${caseId}/events`, {
    headers: getAuthHeaders(),
  });
}

export async function fetchVerifierCaseNotes(caseId: string): Promise<VerifierNote[]> {
  return apiFetch<VerifierNote[]>(`${VERIFIER_BASE}/cases/${caseId}/notes`, {
    headers: getAuthHeaders(),
  });
}

export async function fetchVerifierCaseSubmission(caseId: string): Promise<any> {
  return apiFetch<any>(`${VERIFIER_BASE}/cases/${caseId}/submission`, {
    headers: getAuthHeaders(),
  });
}

export async function fetchVerifierCaseAttachments(caseId: string): Promise<any[]> {
  return apiFetch<any[]>(`${VERIFIER_BASE}/cases/${caseId}/attachments`, {
    headers: getAuthHeaders(),
  });
}

export async function downloadVerifierAttachment(attachmentId: string): Promise<Blob> {
  const url = `${API_BASE}${VERIFIER_BASE}/attachments/${attachmentId}/download`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status}`);
  }
  return response.blob();
}

export async function bulkVerifierCaseAction(payload: {
  case_ids: string[];
  action: "approve" | "reject" | "needs_review";
  actor?: string;
  reason?: string;
}): Promise<{ updated_count: number; failures: Array<{ case_id: string; reason: string }> }>
{
  return apiFetch<{ updated_count: number; failures: Array<{ case_id: string; reason: string }> }>(
    `${VERIFIER_BASE}/cases/bulk/actions`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function bulkVerifierCaseAssign(payload: {
  case_ids: string[];
  assignee: string | null;
  actor?: string;
}): Promise<{ updated_count: number; failures: Array<{ case_id: string; reason: string }> }>
{
  return apiFetch<{ updated_count: number; failures: Array<{ case_id: string; reason: string }> }>(
    `${VERIFIER_BASE}/cases/bulk/assign`,
    {
      method: "POST",
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    }
  );
}

export async function getDecisionPacket(
  caseId: string,
  includeExplain: boolean = true
): Promise<any> {
  const flag = includeExplain ? 1 : 0;
  return apiFetch<any>(`${VERIFIER_BASE}/cases/${caseId}/packet?include_explain=${flag}`, {
    headers: getAuthHeaders(),
  });
}

export async function downloadDecisionPacketPdf(
  caseId: string,
  includeExplain: boolean = true
): Promise<Blob> {
  const flag = includeExplain ? 1 : 0;
  const url = `${API_BASE}${VERIFIER_BASE}/cases/${caseId}/packet.pdf?include_explain=${flag}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  return response.blob();
}

export async function downloadAuditZip(
  caseId: string,
  includeExplain: boolean = true
): Promise<Blob> {
  const flag = includeExplain ? 1 : 0;
  const url = `${API_BASE}${VERIFIER_BASE}/cases/${caseId}/audit.zip?include_explain=${flag}`;
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    throw new Error(`Failed to download ZIP: ${response.status}`);
  }
  return response.blob();
}

export async function seedVerifierCases(): Promise<{ inserted_cases: number; inserted_events: number }>
{
  return apiFetch<{ inserted_cases: number; inserted_events: number }>(
    "/api/ops/seed-verifier-cases",
    {
      method: "POST",
      headers: getJsonHeaders(),
    }
  );
}
