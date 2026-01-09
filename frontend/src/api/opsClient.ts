// frontend/src/api/opsClient.ts
import { API_BASE } from "../lib/api";

export interface OpsSubmission {
  submission_id: string;
  csf_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  title: string;
  subtitle: string;
  decision_status: string | null;
  risk_level: string | null;
  trace_id: string;
}

export async function getOpsSubmissions(
  status?: string,
  limit: number = 100
): Promise<OpsSubmission[]> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  params.append("limit", limit.toString());

  const resp = await fetch(
    `${API_BASE}/api/v1/admin/ops/submissions?${params}`
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch ops submissions: ${resp.status}`);
  }

  return resp.json();
}
