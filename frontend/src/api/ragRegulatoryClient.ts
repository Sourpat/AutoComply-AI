// src/api/ragRegulatoryClient.ts
import { API_BASE } from "./csfHospitalClient";

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
    const text = await resp.text().catch(() => "");
    const message = text ? `${resp.status}: ${text}` : `${resp.status}`;
    throw new Error(`RAG regulatory explain failed: ${message}`);
  }

  return resp.json();
}
