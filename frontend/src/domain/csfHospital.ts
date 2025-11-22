// src/domain/csfHospital.ts

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
}

export type HospitalCsfDecisionStatus =
  | "ok_to_ship"
  | "blocked"
  | "manual_review";

export interface HospitalCsfDecision {
  status: HospitalCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
}
