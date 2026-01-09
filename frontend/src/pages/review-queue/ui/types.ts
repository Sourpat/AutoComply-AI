// frontend/src/pages/review-queue/ui/types.ts
export interface ReviewQueueItemUI {
  id: number;
  question_text: string;
  status: string;
  reason_code: string | null;
  created_at: string;
  assigned_to: string | null;
  top_match_score: number | null;
  draft_answer: string | null;
}

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

