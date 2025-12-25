// frontend/src/api/reviewQueueClient.ts
import { API_BASE } from "../lib/api";

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

export async function getReviewQueueItems(
  status?: string,
  limit: number = 50,
  offset: number = 0
): Promise<ReviewQueueListResponse> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());

  const resp = await fetch(
    `${API_BASE}/api/v1/admin/review-queue/items?${params}`
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch review queue: ${resp.status}`);
  }

  return resp.json();
}

export async function getReviewQueueItem(
  itemId: number
): Promise<ReviewQueueItem> {
  const resp = await fetch(
    `${API_BASE}/api/v1/admin/review-queue/items/${itemId}`
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch review item: ${resp.status}`);
  }

  return resp.json();
}

export async function assignReviewItem(
  itemId: number,
  assignedTo: string
): Promise<any> {
  const resp = await fetch(
    `${API_BASE}/api/v1/admin/review-queue/items/${itemId}/assign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assigned_to: assignedTo }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to assign review item: ${resp.status}`);
  }

  return resp.json();
}

export async function updateDraftAnswer(
  itemId: number,
  draftAnswer: string
): Promise<any> {
  const resp = await fetch(
    `${API_BASE}/api/v1/admin/review-queue/items/${itemId}/update-draft`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ draft_answer: draftAnswer }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to update draft answer: ${resp.status}`);
  }

  return resp.json();
}

export async function publishAnswer(
  itemId: number,
  finalAnswer: string,
  tags?: string[]
): Promise<any> {
  const resp = await fetch(
    `${API_BASE}/api/v1/admin/review-queue/items/${itemId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ final_answer: finalAnswer, tags }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to publish answer: ${resp.status}`);
  }

  return resp.json();
}

export async function rejectReviewItem(itemId: number): Promise<any> {
  const resp = await fetch(
    `${API_BASE}/api/v1/admin/review-queue/items/${itemId}/reject`,
    {
      method: "POST",
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to reject review item: ${resp.status}`);
  }

  return resp.json();
}

export async function getQueueStats(): Promise<any> {
  const resp = await fetch(`${API_BASE}/api/v1/admin/review-queue/stats`);

  if (!resp.ok) {
    throw new Error(`Failed to fetch queue stats: ${resp.status}`);
  }

  return resp.json();
}
