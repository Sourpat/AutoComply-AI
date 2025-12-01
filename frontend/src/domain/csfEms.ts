// src/domain/csfEms.ts
import { ControlledSubstanceItem } from "./controlledSubstances";

export type EmsFacilityType =
  | "facility"
  | "hospital"
  | "long_term_care"
  | "surgical_center"
  | "clinic"
  | "other";

export interface EmsCsfFormData {
  facilityName: string;
  facilityType: EmsFacilityType;
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

export type EmsCsfDecisionStatus =
  | "ok_to_ship"
  | "blocked"
  | "manual_review";

export interface EmsCsfDecision {
  status: EmsCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
}

export interface EmsFormCopilotSource {
  id?: string;
  title: string;
  url?: string;
  snippet?: string;
}

export interface EmsFormCopilotResponse {
  status: EmsCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
  rag_explanation: string;
  artifacts_used: string[];
  rag_sources: EmsFormCopilotSource[];
}
