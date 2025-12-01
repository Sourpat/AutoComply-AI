// src/api/csfExplainClient.ts

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

export type CsfDecisionStatus = "ok_to_ship" | "blocked" | "manual_review";

export interface CsfDecisionSummary {
  status: CsfDecisionStatus;
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
