// frontend/src/api/consoleClient.ts
import { API_BASE } from "../lib/api";

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
}

export interface WorkQueueResponse {
  items: WorkQueueSubmission[];
  statistics: Record<string, unknown>;
  total: number;
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

  const resp = await fetch(`${API_BASE}/console/work-queue?${params}`);

  if (!resp.ok) {
    throw new Error(`Failed to fetch work queue: ${resp.status}`);
  }

  return await resp.json();
}
