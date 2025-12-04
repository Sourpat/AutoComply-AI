// src/domain/csfFacility.ts
import { ControlledSubstanceItem } from "./controlledSubstances";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";
import type { CsfCopilotResponse } from "../types/csfCopilot";

export type FacilityFacilityType =
  | "facility"
  | "hospital"
  | "long_term_care"
  | "surgical_center"
  | "clinic"
  | "other";

export interface FacilityCsfFormData {
  facilityName: string;
  facilityType: FacilityFacilityType;
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

export type FacilityCsfDecisionStatus = DecisionStatus;

export interface FacilityCsfDecision extends DecisionOutcome {
  missing_fields?: string[];
}

export type FacilityFormCopilotResponse = CsfCopilotResponse;
