// frontend/src/api/reviewQueueClient.ts
import { apiFetch } from "../lib/api";
import { getAuthHeaders, getJsonHeaders } from "../lib/authHeaders";

const REVIEW_QUEUE_BASE = "/api/v1/admin/review-queue";

export interface ReviewQueueItem {
  id: number;
  question_text: string;
  status: string;
  draft_answer: string | null;
  final_answer: string | null;
  assigned_to: string | null;
  tags: string[] | null;
  priority: number;
  created_at: string;
  assigned_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  published_kb_id: number | null;
  top_match_score: number | null;
  reason_code: string | null;
}

export interface ReviewQueueListResponse {
  items: ReviewQueueItem[];
  total: number;
  stats: {
    open: number;
    in_review: number;
    published: number;
    total: number;
  };
}

export function buildReviewQueueItemsPath(
  status?: string,
  limit: number = 50,
  offset: number = 0
): string {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());
  return `${REVIEW_QUEUE_BASE}/items?${params}`;
}

export async function getReviewQueueItems(
  status?: string,
  limit: number = 50,
  offset: number = 0
): Promise<ReviewQueueListResponse> {
  const path = buildReviewQueueItemsPath(status, limit, offset);
  return apiFetch<ReviewQueueListResponse>(path, {
    headers: getAuthHeaders(),
  });
}

export async function getReviewQueueItem(
  itemId: number
): Promise<ReviewQueueItem> {
  return apiFetch<ReviewQueueItem>(`${REVIEW_QUEUE_BASE}/items/${itemId}`, {
    headers: getAuthHeaders(),
  });
}

export async function assignReviewItem(
  itemId: number,
  assignedTo: string
): Promise<any> {
  return apiFetch(`${REVIEW_QUEUE_BASE}/items/${itemId}/assign`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({ assigned_to: assignedTo }),
  });
}

export async function updateDraftAnswer(
  itemId: number,
  draftAnswer: string
): Promise<any> {
  return apiFetch(`${REVIEW_QUEUE_BASE}/items/${itemId}/update-draft`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({ draft_answer: draftAnswer }),
  });
}

export async function publishAnswer(
  itemId: number,
  finalAnswer: string,
  tags?: string[]
): Promise<any> {
  return apiFetch(`${REVIEW_QUEUE_BASE}/items/${itemId}/publish`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({ final_answer: finalAnswer, tags }),
  });
}

export async function rejectReviewItem(itemId: number): Promise<any> {
  return apiFetch(`${REVIEW_QUEUE_BASE}/items/${itemId}/reject`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
}

export async function getQueueStats(): Promise<any> {
  return apiFetch(`${REVIEW_QUEUE_BASE}/stats`, {
    headers: getAuthHeaders(),
  });
}
