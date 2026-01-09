/**
 * Status transition rules for workflow management.
 * Step 2.0: Workflow Status Transitions + Audit Log Timeline
 */

import type { ActorRole } from "../types/audit";

export type WorkflowStatus = 
  | "submitted" 
  | "needs_review" 
  | "blocked" 
  | "approved" 
  | "request_info";

/**
 * Allowed status transitions.
 * Maps current status -> array of allowed next statuses.
 */
const ALLOWED_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  submitted: ["needs_review", "blocked", "approved", "request_info"],
  needs_review: ["blocked", "approved", "request_info"],
  request_info: ["needs_review", "blocked", "approved"],
  blocked: ["needs_review", "approved"], // Optional: allow unblocking
  approved: [], // No transitions allowed (except admin override)
};

/**
 * Check if a status transition is allowed.
 * @param from Current status
 * @param to Desired status
 * @param role Actor role (admin can override)
 * @returns True if transition is allowed
 */
export function canTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
  role: ActorRole
): boolean {
  // Admin can override and change approved cases
  if (role === "admin") {
    return true;
  }

  // Submitters cannot change status
  if (role === "submitter") {
    return false;
  }

  // Check if transition is in allowed list
  const allowedNextStates = ALLOWED_TRANSITIONS[from] || [];
  return allowedNextStates.includes(to);
}

/**
 * Get allowed next statuses for a given current status and role.
 * @param currentStatus Current workflow status
 * @param role Actor role
 * @returns Array of allowed next statuses
 */
export function getAllowedTransitions(
  currentStatus: WorkflowStatus,
  role: ActorRole
): WorkflowStatus[] {
  // Admin can transition to any status
  if (role === "admin") {
    return ["needs_review", "blocked", "approved", "request_info"];
  }

  // Submitters cannot transition
  if (role === "submitter") {
    return [];
  }

  // Verifiers get standard transitions
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

/**
 * Get human-readable label for status.
 */
export function getStatusLabel(status: WorkflowStatus): string {
  const labels: Record<WorkflowStatus, string> = {
    submitted: "Submitted",
    needs_review: "Needs Review",
    blocked: "Blocked",
    approved: "Approved",
    request_info: "Info Requested",
  };
  return labels[status] || status;
}

/**
 * Get badge color class for status.
 */
export function getStatusColor(status: WorkflowStatus): string {
  const colors: Record<WorkflowStatus, string> = {
    submitted: "bg-blue-100 text-blue-800 border-blue-200",
    needs_review: "bg-amber-100 text-amber-800 border-amber-200",
    blocked: "bg-red-100 text-red-800 border-red-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    request_info: "bg-purple-100 text-purple-800 border-purple-200",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
}
