// src/api/complianceArtifactsClient.ts

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

export type ArtifactType =
  | "STATUTE"
  | "REGULATION"
  | "GUIDANCE"
  | "ADDENDUM"
  | string;

export type ArtifactEngineStatus =
  | "RAW_DOCUMENT"
  | "MODELED_RULES"
  | "PARTIALLY_MODELED"
  | string;

export interface ComplianceArtifact {
  id: string;
  name: string;
  jurisdiction: string;
  artifact_type: ArtifactType;
  source_document: string | null;
  engine_status: ArtifactEngineStatus;
  notes?: string | null;
}

/**
 * Fetch all compliance artifacts from the backend.
 * For now we keep this simple and filter client-side.
 */
export async function fetchComplianceArtifacts(): Promise<ComplianceArtifact[]> {
  const resp = await fetch(`${API_BASE}/compliance/artifacts`);

  if (!resp.ok) {
    throw new Error(
      `Failed to load compliance artifacts (status ${resp.status})`
    );
  }

  return resp.json();
}
