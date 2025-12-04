// src/api/ohioTdddExplainClient.ts
import type { DecisionStatus, RegulatoryReference } from "../types/decision";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

export interface OhioTdddDecisionSummary {
  status: DecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: RegulatoryReference[];
}

export interface OhioTdddExplanation {
  explanation: string;
  regulatory_references: RegulatoryReference[];
}

export async function explainOhioTdddDecision(
  decision: OhioTdddDecisionSummary
): Promise<OhioTdddExplanation> {
  const resp = await fetch(`${API_BASE}/ohio-tddd/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ decision }),
  });

  if (!resp.ok) {
    throw new Error(
      `Ohio TDDD explanation failed with status ${resp.status}`
    );
  }

  return resp.json();
}
