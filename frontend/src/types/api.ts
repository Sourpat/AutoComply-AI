import type { CsfCopilotResponse } from "./csfCopilot";
import type { DecisionOutcome, DecisionStatus } from "./decision";

export interface CsfEvaluateResponse {
  decision: DecisionOutcome;
  status?: DecisionStatus;
  reason?: string;
  missing_fields?: string[];
  regulatory_references?: DecisionOutcome["regulatory_references"];
  trace_id?: string | null;
  debug_info?: Record<string, unknown> | null;
}

export interface LicenseEvaluateResponse {
  decision: DecisionOutcome;
  status?: DecisionStatus;
  reason?: string;
  missing_fields?: string[];
  regulatory_references?: DecisionOutcome["regulatory_references"];
  trace_id?: string | null;
  debug_info?: Record<string, unknown> | null;
}

export interface MockOrderDecisionResponse {
  decision: DecisionOutcome;
  csf_engine?: string | null;
  license_engine?: string | null;
  scenario_id?: string | null;
  developer_trace?: Record<string, unknown> | null;
}

export type HospitalCsfCopilotResponse = CsfCopilotResponse;
export type FacilityCsfCopilotResponse = CsfCopilotResponse;
export type PractitionerCsfCopilotResponse = CsfCopilotResponse;
