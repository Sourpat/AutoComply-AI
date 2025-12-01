// src/domain/csfFacility.ts
import { ControlledSubstanceItem } from "./controlledSubstances";

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

export type FacilityCsfDecisionStatus =
  | "ok_to_ship"
  | "blocked"
  | "manual_review";

export interface FacilityCsfDecision {
  status: FacilityCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
}
