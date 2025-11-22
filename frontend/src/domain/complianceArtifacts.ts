export type ArtifactType =
  | "state_attestation"
  | "controlled_substance_form"
  | "addendum";

export type ArtifactStatus =
  | "raw_document"
  | "modelled"
  | "api_exposed"
  | "ui_sandbox"
  | "full_loop";

export interface ComplianceArtifact {
  id: string;
  name: string;
  jurisdiction: string | null;
  artifact_type: ArtifactType;
  source_document: string | null;
  engine_status: ArtifactStatus;
  notes: string | null;
}
