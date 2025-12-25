// frontend/src/lib/metrics.ts
// Shared metrics calculation utilities for Chat HITL review items

import { type ReviewQueueItem } from "../api/reviewQueueClient";

export interface ChatMetrics {
  open_reviews: number;
  high_risk_open_reviews: number;
  avg_time_to_first_response_hours: number | null;
  auto_answered_rate: number | null;
}

/**
 * Infers risk level from reason code for chat review items
 */
export function inferChatRiskLevel(reasonCode: string | null): "HIGH" | "MEDIUM" | "LOW" {
  if (!reasonCode) return "LOW";
  
  const lower = reasonCode.toLowerCase();
  
  // HIGH: jurisdiction mismatch or unsafe request
  if (lower.includes("jurisdiction") || lower.includes("unsafe")) {
    return "HIGH";
  }
  
  // MEDIUM: low similarity or system errors
  if (lower.includes("low_similarity") || lower.includes("system_error")) {
    return "MEDIUM";
  }
  
  // LOW: everything else
  return "LOW";
}

/**
 * Calculate chat HITL metrics from review queue items
 */
export function calculateChatMetrics(items: ReviewQueueItem[]): ChatMetrics {
  const openItems = items.filter(item => item.status === "open");
  
  // Count high-risk open items
  const highRiskOpen = openItems.filter(item => 
    inferChatRiskLevel(item.reason_code) === "HIGH"
  ).length;
  
  // Average time to first response - not available in current data model
  // Would need to track first_response_at timestamp in backend
  const avgResponseTime: number | null = null;
  
  // Auto-answered rate - not available in current data model
  // Would need to track auto_answer_attempted flag in backend
  const autoAnsweredRate: number | null = null;
  
  return {
    open_reviews: openItems.length,
    high_risk_open_reviews: highRiskOpen,
    avg_time_to_first_response_hours: avgResponseTime,
    auto_answered_rate: autoAnsweredRate,
  };
}

/**
 * Get unique filter values from review items
 */
export function getUniqueFilterValues(items: ReviewQueueItem[]) {
  return {
    statuses: [...new Set(items.map(i => i.status))].filter(Boolean),
    reasonCodes: [...new Set(items.map(i => i.reason_code))].filter((r): r is string => r !== null),
    // Note: jurisdiction would come from question_event if available
    jurisdictions: [] as string[],
    riskLevels: ["HIGH", "MEDIUM", "LOW"] as const,
  };
}
