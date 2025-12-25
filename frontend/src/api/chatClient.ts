// frontend/src/api/chatClient.ts
import { API_BASE } from "../lib/api";

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

export async function askQuestion(
  request: ChatRequest
): Promise<ChatResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/chat/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const message = text ? `${resp.status}: ${text}` : `${resp.status}`;
    throw new Error(`Chat request failed: ${message}`);
  }

  return resp.json();
}

export async function getChatHistory(
  session_id: string
): Promise<{ session_id: string; messages: Array<any> }> {
  const resp = await fetch(`${API_BASE}/api/v1/chat/history/${session_id}`);

  if (!resp.ok) {
    throw new Error(`Failed to fetch chat history: ${resp.status}`);
  }

  return resp.json();
}
