// src/api/ohioTdddExplainClient.ts

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

export type OhioTdddDecisionStatus = "approved" | "blocked" | "manual_review";

export interface OhioTdddDecisionSummary {
  status: OhioTdddDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
}

export interface OhioTdddExplanation {
  explanation: string;
  regulatory_references: string[];
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
