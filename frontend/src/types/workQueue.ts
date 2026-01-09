/**
 * Work Queue and Submission Types
 * 
 * Types for the demo-safe persistence layer using localStorage.
 */

export type WorkQueueStatus = "submitted" | "blocked" | "needs_review" | "approved" | "request_info";
export type Priority = "low" | "medium" | "high";
export type ItemKind = "csf" | "license";

export interface AssignedUser {
  id: string;
  name: string;
}

export interface WorkQueueItem {
  id: string;
  kind: ItemKind;
  title: string;
  status: WorkQueueStatus;
  priority: Priority;
  createdAt: string; // ISO timestamp
  submissionId?: string;
  traceId?: string;
  reason?: string;
  // Assignment fields
  assignedTo?: AssignedUser | null;
  assignedAt?: string | null;
  // SLA fields
  slaHours?: number; // Default SLA in hours based on kind
  dueAt?: string; // ISO timestamp: createdAt + slaHours
  // Additional display fields
  subtitle?: string;
  age?: string;
  priorityColor?: string;
  // Decision type for playbook routing (Step 2.15)
  decisionType?: 'csf_practitioner' | 'ohio_tddd' | 'ny_pharmacy_license' | 'csf_facility' | string;
}

export interface Submission {
  id: string;
  kind: ItemKind;
  displayName: string; // e.g., "Practitioner CSF – ACCT-88990"
  submittedAt: string; // ISO timestamp
  payload: any; // Store form snapshot
  decisionTrace?: any; // Store trace replay JSON if available
  // Additional metadata
  status?: WorkQueueStatus;
  traceId?: string;
  csfType?: string;
  tenantId?: string;
}
