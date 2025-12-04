// src/api/csfExplainClient.ts
import type { DecisionStatus, RegulatoryReference } from "../types/decision";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "";

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
  regulatory_references: RegulatoryReference[];
}

export interface CsfExplanation {
  explanation: string;
  regulatory_references: RegulatoryReference[];
}

export async function explainCsfDecision(
  csfType: CsfType,
  decision: CsfDecisionSummary
): Promise<CsfExplanation> {
  const resp = await fetch(`${API_BASE}/csf/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      csf_type: csfType,
      decision,
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `CSF explanation request failed with status ${resp.status}`
    );
  }

  return resp.json();
}
