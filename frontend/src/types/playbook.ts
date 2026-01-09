/**
 * Playbook Types
 * 
 * Schema for reviewer playbooks that guide consistent case reviews
 * with step-by-step checklists and suggested actions.
 * 
 * Step 2.6: Reviewer Playbooks
 */

export type PlaybookStepSeverity = "block" | "review" | "info";
export type PlaybookStepState = "pending" | "satisfied" | "attention" | "blocked";
export type PlaybookActionKind = "REQUEST_INFO" | "NEEDS_REVIEW" | "BLOCK" | "APPROVE" | "ADD_NOTE";

export interface PlaybookStep {
  id: string;
  label: string;
  detail?: string;
  evidenceTags?: string[];     // Used to map evidence/rules
  ruleIds?: string[];          // Optional direct mapping to fired rules
  severity?: PlaybookStepSeverity;
  required?: boolean;
}

export interface PlaybookAction {
  id: string;
  label: string;
  kind: PlaybookActionKind;
  template?: string;           // For request info / notes
  when?: {
    statuses?: string[];       // Only show for these case statuses
    requiresNoBlockers?: boolean;
  };
}

export interface Playbook {
  id: string;                  // e.g., "csf_practitioner_v1"
  decisionType: string;        // "csf_practitioner", "ohio_tddd", etc.
  title: string;
  description: string;
  steps: PlaybookStep[];
  suggestedActions: PlaybookAction[];
}

export interface PlaybookStepWithState extends PlaybookStep {
  state: PlaybookStepState;
  linkedRules?: string[];      // Rule IDs that caused this state
  linkedEvidence?: string[];   // Evidence IDs relevant to this step
}

export interface PlaybookEvaluation {
  playbook: Playbook;
  steps: PlaybookStepWithState[];
  suggestedActions: PlaybookAction[];
  summary: {
    totalSteps: number;
    blockedSteps: number;
    attentionSteps: number;
    satisfiedSteps: number;
    pendingSteps: number;
  };
}
