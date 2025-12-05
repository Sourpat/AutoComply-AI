import type { DecisionOutcome } from "./decision";

export interface DecisionAuditEntry {
  trace_id: string;
  engine_family: string;
  decision_type: string;
  status: string;
  reason: string;
  risk_level?: string | null;
  created_at: string; // ISO string
  decision: DecisionOutcome;
}
