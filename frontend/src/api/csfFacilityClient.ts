// src/api/csfFacilityClient.ts
import type { HospitalCsfDecision } from "../domain/csfHospital";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || process.env.VITE_API_BASE || "";

export interface FacilityFormCopilotResponse {
  engine_family: string;
  decision_type: string;
  decision: HospitalCsfDecision;
  explanation: string;
}

export async function callFacilityFormCopilot(
  decision: HospitalCsfDecision,
  question: string
): Promise<FacilityFormCopilotResponse> {
  const resp = await fetch(`${API_BASE}/csf/facility/form-copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      engine_family: "csf",
      decision_type: "csf_facility",
      decision: {
        status: decision.status,
        reason: decision.reason,
        missing_fields: decision.missing_fields ?? [],
        regulatory_references: decision.regulatory_references ?? [],
      },
      ask: question,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const message = text ? `${resp.status}: ${text}` : `${resp.status}`;
    throw new Error(`Facility Form Copilot failed with status ${message}`);
  }

  return resp.json();
}
