export type JSONSchema = {
  type: "object" | "string" | "number" | "boolean";
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
};

export enum CaseStatus {
  Draft = "draft",
  Evaluating = "evaluating",
  NeedsInput = "needs_input",
  QueuedReview = "queued_review",
  Approved = "approved",
  Blocked = "blocked",
  Completed = "completed",
}

export type AgentActionIntent =
  | "run_check"
  | "ask_user"
  | "route_review"
  | "apply_fix"
  | "open_console"
  | "export_audit";

export type AgentAction = {
  id: string;
  label: string;
  intent: AgentActionIntent;
  requiresConfirmation: boolean;
  inputSchema: JSONSchema;
  payload?: unknown;
};

export type AgentQuestion = {
  id: string;
  prompt: string;
  inputSchema: JSONSchema;
};

export type AgentRuleEvaluation = {
  ruleId: string;
  outcome: "pass" | "fail" | "unknown";
  evidence?: string[];
};

export type AgentTrace = {
  traceId: string;
  timestamp: string;
  rulesEvaluated: AgentRuleEvaluation[];
  modelNotes: string[];
};

export type AgentPlan = {
  caseId: string;
  status: CaseStatus;
  summary: string;
  confidence: number;
  recommendedActions: AgentAction[];
  questions: AgentQuestion[];
  nextState: CaseStatus;
  trace: AgentTrace;
};
