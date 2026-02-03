// frontend/src/api/chatClient.ts
import { apiFetch } from "../lib/api";

export interface ChatRequest {
  question: string;
  session_id?: string;
  user_id?: string;
}

export interface DecisionTrace {
  kb_searched: boolean;
  top_match_score: number | null;
  top_3_matches: Array<{
    kb_id: number;
    canonical_question: string;
    score: number;
  }>;
  similarity_threshold: number;
  passed_similarity_gate: boolean;
  passed_policy_gate: boolean;
  gating_decision: string; // "ANSWERED" or "NEEDS_REVIEW"
  reason_code: string | null;
  queue_item_id: number | null;
  model_metadata: Record<string, any>;
}

export interface ChatResponse {
  answer: string;
  decision_trace: DecisionTrace;
  session_id: string;
  message_id: number;
  reviewer_draft?: string;  // Detailed markdown draft for admin views (only present for NEEDS_REVIEW)
}

const CHAT_BASE = "/api/chat";

const DECISION_TRACE_DEFAULTS: DecisionTrace = {
  kb_searched: false,
  top_match_score: null,
  top_3_matches: [],
  similarity_threshold: 0,
  passed_similarity_gate: false,
  passed_policy_gate: false,
  gating_decision: "NEEDS_REVIEW",
  reason_code: null,
  queue_item_id: null,
  model_metadata: {},
};

function normalizeChatResponse(payload: ChatResponse): ChatResponse {
  const trace = payload?.decision_trace ?? ({} as DecisionTrace);
  return {
    ...payload,
    decision_trace: {
      ...DECISION_TRACE_DEFAULTS,
      ...trace,
      top_3_matches: trace.top_3_matches ?? [],
      model_metadata: trace.model_metadata ?? {},
      top_match_score: trace.top_match_score ?? null,
      reason_code: trace.reason_code ?? null,
      queue_item_id: trace.queue_item_id ?? null,
    },
  };
}

export async function askQuestion(
  request: ChatRequest
): Promise<ChatResponse> {
  const payload = await apiFetch<ChatResponse>(`${CHAT_BASE}/ask`, {
    method: "POST",
    body: JSON.stringify(request),
  });

  return normalizeChatResponse(payload);
}

export async function getChatHistory(
  session_id: string
): Promise<{ session_id: string; messages: Array<any> }> {
  return apiFetch<{ session_id: string; messages: Array<any> }>(
    `${CHAT_BASE}/history/${session_id}`
  );
}
