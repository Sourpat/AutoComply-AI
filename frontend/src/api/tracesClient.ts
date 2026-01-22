// frontend/src/api/tracesClient.ts
import { API_BASE } from "../lib/api";

export interface TraceSummary {
  trace_id: string;
  case_id: string;
  request_id: string | null;
  created_at: string;
  span_count: number;
  error_count: number;
  total_duration_ms: number | null;
  has_errors: boolean;
}

export interface TraceSpan {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  span_name: string;
  span_kind: string;
  duration_ms: number | null;
  error_text: string | null;
  metadata: Record<string, unknown>;
  case_id: string;
  request_id: string | null;
  created_at: string;
}

export interface TraceDetail {
  trace_id: string;
  root_span: TraceSpan | null;
  child_spans: TraceSpan[];
  total_spans: number;
  total_duration_ms: number | null;
  has_errors: boolean;
  labels: TraceLabels | null;
}

export interface TraceLabels {
  open_codes: string[];
  axial_category: string | null;
  pass_fail: boolean | null;
  severity: string | null;
  notes: string | null;
}

export interface TraceListResponse {
  traces: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export async function listTraces(
  caseId?: string,
  limit: number = 50,
  offset: number = 0
): Promise<TraceListResponse> {
  const params = new URLSearchParams();
  if (caseId) params.append("case_id", caseId);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());

  const resp = await fetch(`${API_BASE}/traces?${params}`);

  if (!resp.ok) {
    throw new Error(`Failed to fetch traces: ${resp.status}`);
  }

  return await resp.json();
}

export async function getTraceDetail(traceId: string): Promise<TraceDetail> {
  const resp = await fetch(`${API_BASE}/traces/${traceId}`);

  if (!resp.ok) {
    throw new Error(`Failed to fetch trace ${traceId}: ${resp.status}`);
  }

  return await resp.json();
}

export async function addTraceLabels(
  traceId: string,
  labels: TraceLabels
): Promise<{ success: boolean; trace_id: string; labels: TraceLabels }> {
  const resp = await fetch(`${API_BASE}/traces/${traceId}/labels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(labels),
  });

  if (!resp.ok) {
    throw new Error(`Failed to add labels to trace ${traceId}: ${resp.status}`);
  }

  return await resp.json();
}
