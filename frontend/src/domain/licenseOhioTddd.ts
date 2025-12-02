export interface OhioTdddFormData {
  tdddNumber: string;
  facilityName: string;
  accountNumber?: string;
  shipToState: string;
  licenseType: string; // always "ohio_tddd"
  attestationAccepted: boolean;
  internalNotes?: string;
}

export interface OhioTdddDecision {
  status: "ok_to_ship" | "needs_review" | "blocked";
  reason: string;
  missingFields: string[];
}

export interface OhioTdddFormCopilotSource {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface OhioTdddFormCopilotResponse {
  status: "ok_to_ship" | "needs_review" | "blocked";
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
  rag_explanation: string;
  artifacts_used: string[];
  rag_sources: OhioTdddFormCopilotSource[];
}
