// src/types/decision.ts

export type DecisionStatus = "ok_to_ship" | "needs_review" | "blocked";

export type PolicyAllowedAction = "auto_decide" | "require_human" | "escalate" | "block";

export interface PolicyGate {
  gate_name: string;
  pass: boolean;
  explanation: string;
  input?: unknown;
}

export interface PolicyTrace {
  allowed_action: PolicyAllowedAction;
  contract_version_used: string;
  reason_codes: string[];
  gates: PolicyGate[];
  fail_safe: boolean;
}

export interface RegulatoryReference {
  id: string;
  jurisdiction?: string | null;
  source?: string | null;
  citation?: string | null;
  label?: string | null;
}

export interface DecisionOutcome {
  status: DecisionStatus;
  reason: string;
  risk_level?: string | null;
  risk_score?: number | null;
  regulatory_references: RegulatoryReference[];
  trace_id?: string | null;
  debug_info?: Record<string, unknown> | null;
  policy_trace?: PolicyTrace | null;
}
