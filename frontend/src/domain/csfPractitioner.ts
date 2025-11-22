// src/domain/csfPractitioner.ts

export type PractitionerFacilityType =
  | "individual_practitioner"
  | "group_practice"
  | "clinic"
  | "dental_practice"
  | "other";

export interface PractitionerCsfFormData {
  facilityName: string;
  facilityType: PractitionerFacilityType;
  accountNumber?: string | null;

  practitionerName: string;
  stateLicenseNumber: string;
  deaNumber: string;

  shipToState: string; // e.g. "OH"

  attestationAccepted: boolean;

  internalNotes?: string | null;
}

export type PractitionerCsfDecisionStatus =
  | "ok_to_ship"
  | "blocked"
  | "manual_review";

export interface PractitionerCsfDecision {
  status: PractitionerCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
}
