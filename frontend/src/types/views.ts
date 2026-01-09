/**
 * Queue View Types
 * 
 * Types for saved queue views with filters, search, and sort.
 * Step 2.3: Queue Search + Saved Views + Shareable URLs
 */

export type SortField = "overdue" | "priority" | "age" | "status" | "assignee";
export type SortDirection = "asc" | "desc";

export interface QueueFilters {
  status?: string[]; // e.g., ["blocked", "needs_review"]
  assignee?: "me" | "unassigned" | string; // "me", "unassigned", or user id
  overdue?: boolean;
  priority?: string[]; // e.g., ["high", "medium"]
  kind?: string[]; // e.g., ["csf", "license"]
  decisionType?: string; // Step 2.15: e.g., "csf_practitioner", "ohio_tddd", "ny_pharmacy_license", "csf_facility"
}

export interface QueueSort {
  field: SortField;
  direction: SortDirection;
}

export interface QueueView {
  id: string;
  name: string;
  query: string; // Search query
  filters: QueueFilters;
  sort: QueueSort;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QueueViewCreateInput {
  name: string;
  query?: string;
  filters?: QueueFilters;
  sort?: QueueSort;
  isDefault?: boolean;
}
