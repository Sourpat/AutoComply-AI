// src/domain/csfResearcher.ts
import { ControlledSubstanceItem } from "./controlledSubstances";

export type ResearcherFacilityType =
  | "facility"
  | "hospital"
  | "long_term_care"
  | "surgical_center"
  | "clinic"
  | "researcher"
  | "other";

export interface ResearcherCsfFormData {
  facilityName: string;
  facilityType: ResearcherFacilityType;
  accountNumber?: string | null;

  pharmacyLicenseNumber: string;
  deaNumber: string;

  pharmacistInChargeName: string;
  pharmacistContactPhone?: string | null;

  shipToState: string;

  attestationAccepted: boolean;

  internalNotes?: string | null;

  controlledSubstances?: ControlledSubstanceItem[];
}

export type ResearcherCsfDecisionStatus =
  | "ok_to_ship"
  | "blocked"
  | "manual_review";

export interface ResearcherCsfDecision {
  status: ResearcherCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
}

export interface ResearcherFormCopilotSource {
  id?: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface ResearcherFormCopilotResponse {
  status: ResearcherCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
  rag_explanation: string;
  artifacts_used: string[];
  rag_sources: ResearcherFormCopilotSource[];
}
