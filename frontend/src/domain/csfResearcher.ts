// src/domain/csfResearcher.ts
import { ControlledSubstanceItem } from "./controlledSubstances";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";
import type { CsfCopilotResponse } from "../types/csfCopilot";

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

export type ResearcherCsfDecisionStatus = DecisionStatus;

export interface ResearcherCsfDecision extends DecisionOutcome {
  missing_fields?: string[];
}

export type ResearcherFormCopilotResponse = CsfCopilotResponse;
