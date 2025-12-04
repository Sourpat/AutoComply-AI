// src/domain/csfPractitioner.ts

import { ControlledSubstanceItem } from "./controlledSubstances";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";
import type { CsfCopilotResponse } from "../types/csfCopilot";

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

  // Controlled substance items attached to this CSF
  controlledSubstances?: ControlledSubstanceItem[];
}

export type PractitionerCsfDecisionStatus = DecisionStatus;

export interface PractitionerCsfDecision extends DecisionOutcome {
  missing_fields?: string[];
}

export type PractitionerFormCopilotResponse = CsfCopilotResponse;
