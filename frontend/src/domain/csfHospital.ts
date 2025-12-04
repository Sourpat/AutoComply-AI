// src/domain/csfHospital.ts
import { ControlledSubstanceItem } from "./controlledSubstances";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";

export type HospitalFacilityType =
  | "hospital"
  | "long_term_care"
  | "surgical_center"
  | "clinic"
  | "other";

export interface HospitalCsfFormData {
  facilityName: string;
  facilityType: HospitalFacilityType;
  accountNumber?: string | null;

  pharmacyLicenseNumber: string;
  deaNumber: string;

  pharmacistInChargeName: string;
  pharmacistContactPhone?: string | null;

  shipToState: string; // e.g. "OH"

  attestationAccepted: boolean;

  internalNotes?: string | null;

  // NEW: attached controlled substances
  controlledSubstances?: ControlledSubstanceItem[];
}

export type HospitalCsfDecisionStatus = DecisionStatus;

export interface HospitalCsfDecision extends DecisionOutcome {
  missing_fields?: string[];
}
