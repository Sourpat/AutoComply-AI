import type { DecisionOutcome, PolicyOverrideDetail } from "./decision";

export interface DecisionAuditEntry {
  event_type?: string | null;
  trace_id: string;
  engine_family: string;
  decision_type: string;
  status: string;
  reason: string;
  risk_level?: string | null;
  created_at: string; // ISO string
  decision: DecisionOutcome;
  override?: PolicyOverrideDetail | null;
  policy_contract_version_used?: string | null;
  policy_contract_version_active?: string | null;
  policy_drift?: boolean | null;
}

/**
 * Workflow audit event types for status transitions and timeline tracking.
 * Step 2.0: Workflow Status Transitions + Audit Log Timeline
 */

export type AuditAction = 
  | "SUBMITTED" 
  | "APPROVED" 
  | "NEEDS_REVIEW" 
  | "BLOCKED" 
  | "REQUEST_INFO" 
  | "NOTE_ADDED"
  | "ASSIGNED"
  | "UNASSIGNED";

export type ActorRole = "submitter" | "verifier" | "admin";

export interface AuditEvent {
  id: string;
  caseId: string; // Links to workQueueItem.id
  submissionId?: string;
  actorRole: ActorRole;
  actorName: string; // e.g., "Verifier", "Dr. Smith", "Admin"
  action: AuditAction;
  message?: string; // Optional note or request info message
  createdAt: string; // ISO timestamp
  meta?: {
    missingFields?: string[];
    firedRuleIds?: string[];
    evidenceDocIds?: string[];
    assigneeId?: string;
    assigneeName?: string;
    previousAssigneeId?: string;
    previousAssigneeName?: string;
  };
}

export interface AuditEventCreateInput {
  caseId: string;
  submissionId?: string;
  actorRole: ActorRole;
  actorName: string;
  action: AuditAction;
  message?: string;
  meta?: {
    missingFields?: string[];
    firedRuleIds?: string[];
    evidenceDocIds?: string[];
    assigneeId?: string;
    assigneeName?: string;
    previousAssigneeId?: string;
    previousAssigneeName?: string;
  };
}
