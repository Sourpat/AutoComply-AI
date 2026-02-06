// frontend/src/api/verifierCasesClient.ts
import { apiFetch } from "../lib/api";
import { getAuthHeaders, getJsonHeaders } from "../lib/authHeaders";

const VERIFIER_BASE = "/api/verifier";

export type VerifierCase = {
  case_id: string;
  submission_id: string;
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

export type VerifierCasesResponse = {
  items: VerifierCase[];
  limit: number;
  offset: number;
  count: number;
};

export type VerifierCaseDetail = {
  case: VerifierCase;
  events: VerifierCaseEvent[];
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
