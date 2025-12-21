// src/api/csfExplainClient.ts
import { apiFetch } from "../lib/api";
import type { DecisionStatus, RegulatoryReference } from "../types/decision";

export type CsfType =
  | "practitioner"
  | "hospital"
  | "facility"
  | "researcher"
  | "surgery_center"
  | "ems";

export interface CsfDecisionSummary {
  status: DecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
}

export interface CsfExplanation {
  explanation: string;
  regulatory_references: string[];
}

export async function explainCsfDecision(
  csfType: CsfType,
  decision: CsfDecisionSummary
): Promise<CsfExplanation> {
  return apiFetch<CsfExplanation>("/csf/explain", {
    method: "POST",
    body: JSON.stringify({
      csf_type: csfType,
      decision,
    }),
  });
}
