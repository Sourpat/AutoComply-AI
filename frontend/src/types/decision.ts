// src/types/decision.ts

export type DecisionStatus = "ok_to_ship" | "needs_review" | "blocked";

export interface RegulatoryReference {
  id: string;
  jurisdiction?: string | null;
  source?: string | null;
  citation?: string | null;
  label: string;
}

export interface DecisionOutcome {
  status: DecisionStatus;
  reason: string;
  risk_level?: string | null;
  risk_score?: number | null;
  regulatory_references: RegulatoryReference[];
  trace_id?: string | null;
  debug_info?: Record<string, unknown> | null;
}
