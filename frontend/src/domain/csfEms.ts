// src/domain/csfEms.ts
import { ControlledSubstanceItem } from "./controlledSubstances";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";
import type { CsfCopilotResponse } from "../types/csfCopilot";

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

export type EmsCsfDecisionStatus = DecisionStatus;

export interface EmsCsfDecision extends DecisionOutcome {
  missing_fields?: string[];
}

export type EmsFormCopilotResponse = CsfCopilotResponse;
