import type { DecisionOutcome } from "../types/decision";

export interface OhioHospitalOrderApprovalResult {
  decision: DecisionOutcome;
  csf_decision?: DecisionOutcome;
  license_decision?: DecisionOutcome;
  csf_engine?: string | null;
  license_engine?: string | null;
  scenario_id?: string | null;
  developer_trace?: Record<string, unknown> | null;
  notes?: string[];
}

export interface NyPharmacyOrderApprovalResult {
  decision: DecisionOutcome;
  license_engine?: string | null;
  scenario_id?: string | null;
  developer_trace?: Record<string, unknown> | null;
  notes?: string[];
}
