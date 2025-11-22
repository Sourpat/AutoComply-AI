import { ComplianceArtifact } from "../domain/complianceArtifacts";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

export async function fetchComplianceArtifacts(): Promise<ComplianceArtifact[]> {
  const resp = await fetch(`${API_BASE}/compliance/artifacts`);
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch compliance artifacts (status ${resp.status})`
    );
  }
  return resp.json();
}
