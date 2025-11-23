// src/api/ragRegulatoryClient.ts

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

export interface RegulatoryRagRequest {
  question: string;
  regulatory_references: string[];
  decision?: unknown;
}

export interface RegulatoryRagResponse {
  answer: string;
  regulatory_references: string[];
  artifacts_used: string[];
  debug: Record<string, unknown>;
}

export async function callRegulatoryRag(
  payload: RegulatoryRagRequest
): Promise<RegulatoryRagResponse> {
  const resp = await fetch(`${API_BASE}/rag/regulatory-explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(
      `/rag/regulatory-explain failed with status ${resp.status}`
    );
  }

  return resp.json();
}
