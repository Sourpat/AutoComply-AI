import type { RagSearchResponse, RagSource } from "../types/rag";
import { API_BASE } from "../lib/api";

const RAG_SEARCH_ENDPOINT = "/rag/regulatory/search";
const RAG_EXPLAIN_ENDPOINT = "/rag/regulatory-explain";
const RAG_SCENARIOS_ENDPOINT = "/rag/regulatory/scenarios";

function normalizeRagSource(raw: any): RagSource {
  const scoreValue =
    typeof raw?.score === "number"
      ? raw.score
      : typeof raw?.relevance === "number"
        ? raw.relevance
        : typeof raw?.raw_score === "number"
          ? raw.raw_score
          : 0;

  return {
    id: raw?.id ?? raw?.doc_id ?? raw?.source_id ?? undefined,
    label: raw?.label ?? raw?.title ?? raw?.citation ?? raw?.id ?? undefined,
    jurisdiction:
      raw?.jurisdiction_label ??
      raw?.jurisdiction ??
      raw?.source?.jurisdiction ??
      raw?.jurisdiction_code ??
      undefined,
    citation: raw?.citation ?? raw?.code ?? undefined,
    snippet: raw?.snippet ?? raw?.text ?? "",
    score: Math.max(0, Math.min(1, scoreValue ?? 0)),
    raw_score: raw?.raw_score ?? raw?.rawScore ?? undefined,
    url: raw?.url ?? raw?.link ?? undefined,
    source_type: raw?.source_type ?? raw?.type ?? raw?.document_type ?? undefined,
  };
}

function normalizeRagSearchResponse(data: any, fallbackQuery: string): RagSearchResponse {
  const rawSources = Array.isArray(data?.sources)
    ? data.sources
    : Array.isArray(data?.results)
      ? data.results
      : [];

  return {
    query: data?.query ?? fallbackQuery,
    sources: rawSources.map(normalizeRagSource),
  };
}

export async function ragSearch(
  query: string,
  filters?: Record<string, unknown>
): Promise<RagSearchResponse> {
  const res = await fetch(`${API_BASE}${RAG_SEARCH_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...(filters ?? {}) }),
  });

  if (!res.ok) {
    let errorMessage = `Search failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : errorData.detail?.message || errorMessage;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Failed to parse error response, use default message
    }
    const error: any = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }

  const data = await res.json();
  return normalizeRagSearchResponse(data, query);
}

export interface FiredRule {
  id: string;
  title: string;
  severity: string;
  jurisdiction: string;
  citation: string;
  rationale: string;
  snippet: string;
  requirement: string;
}

export interface EvaluatedRule {
  id: string;
  title: string;
  severity: string;
  jurisdiction: string;
  citation: string;
  rationale: string;
  requirement: string;
  status: string; // "passed" | "failed" | "info"
}

export interface DecisionExplainResponse {
  answer: string;
  sources: RagSource[];
  regulatory_references: string[];
  artifacts_used: string[];
  debug: {
    mode: string;
    decision_type: string;
    outcome: "approved" | "needs_review" | "blocked";
    fired_rules_count: number;
    missing_evidence_count: number;
    next_steps_count: number;
    fired_rules: FiredRule[];
    evaluated_rules: EvaluatedRule[];  // NEW
    satisfied_requirements: string[];  // NEW
    decision_summary: string;  // NEW
    missing_evidence: string[];
    next_steps: string[];
  };
}

export interface DecisionScenario {
  id: string;
  name: string;
  description: string;
  decision_type: string;
  engine_family: string;
}

export async function ragExplain(
  decision_type: string,
  engine_family: string,
  evidence: Record<string, any>,
  question: string = "Why was this decision made?"
): Promise<DecisionExplainResponse> {
  const res = await fetch(`${API_BASE}${RAG_EXPLAIN_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      decision_type,
      engine_family,
      decision: { evidence },
    }),
  });

  if (!res.ok) {
    let errorMessage = `Explain failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData?.detail) {
        errorMessage = typeof errorData.detail === 'string' 
          ? errorData.detail 
          : errorData.detail?.message || errorMessage;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Failed to parse error response, use default message
    }
    const error: any = new Error(errorMessage);
    error.status = res.status;
    throw error;
  }

  return await res.json();
}

export async function getDecisionScenarios(): Promise<DecisionScenario[]> {
  const res = await fetch(`${API_BASE}${RAG_SCENARIOS_ENDPOINT}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch scenarios: ${res.status}`);
  }

  const data = await res.json();
  return data.scenarios || [];
}

export interface LastDecisionResponse {
  exists: boolean;
  engine_family?: string;
  decision_type?: string;
  saved_at?: string;
  evidence?: Record<string, any>;
  meta?: Record<string, any>;
}

export async function getLastDecision(
  engineFamily: string,
  decisionType: string
): Promise<LastDecisionResponse> {
  const res = await fetch(
    `${API_BASE}/rag/decisions/last?engine_family=${engineFamily}&decision_type=${decisionType}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch last decision: ${res.status}`);
  }

  return await res.json();
}


export interface RecentSubmissionItem {
  trace_id: string;
  submission_id: string;
  csf_type: string;
  title: string;
  status: string;
  risk?: string;
  created_at: string;
}

export interface RecentSubmissionsResponse {
  submissions: RecentSubmissionItem[];
}

export async function getRecentSubmissions(
  tenant: string = "ohio",
  limit: number = 20
): Promise<RecentSubmissionsResponse> {
  const res = await fetch(
    `${API_BASE}/rag/submissions/recent?tenant=${tenant}&limit=${limit}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch recent submissions: ${res.status}`);
  }

  return await res.json();
}


export interface TraceResponse {
  trace_id: string;
  submission_id: string;
  csf_type: string;
  status: string;
  risk?: string;
  created_at: string;
  decision_summary?: string;
  fired_rules: any[];
  evaluated_rules: any[];
  missing_evidence: string[];
  next_steps: string[];
  evidence: Record<string, any>;
  meta?: Record<string, any>;
}

export async function getTrace(traceId: string): Promise<TraceResponse> {
  const res = await fetch(`${API_BASE}/rag/trace/${traceId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch trace: ${res.status}`);
  }

  return await res.json();
}
