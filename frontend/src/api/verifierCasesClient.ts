// frontend/src/api/verifierCasesClient.ts
import { apiFetch } from "../lib/api";
import { getAuthHeaders, getJsonHeaders } from "../lib/authHeaders";

const VERIFIER_BASE = "/api/verifier";

export type VerifierCase = {
  case_id: string;
  submission_id: string | null;
  status: string;
  jurisdiction: string | null;
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

export type VerifierCaseActionResponse = {
  case: VerifierCase;
  event: VerifierCaseEvent;
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
