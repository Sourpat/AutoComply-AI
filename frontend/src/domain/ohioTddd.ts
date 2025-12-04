import type { DecisionOutcome, DecisionStatus } from "../types/decision";

export type OhioTdddDecisionStatus = DecisionStatus;

export interface OhioTdddDecision extends DecisionOutcome {
  missing_fields?: string[];
}

/**
 * Minimal Ohio TDDD form data model for the sandbox.
 * Adjust field list / types if your Python model differs.
 */
export type OhioTdddLicenseType =
  | "clinic"
  | "hospital"
  | "practitioner"
  | "pharmacy"
  | "other";

export interface OhioTdddFormData {
  businessName: string;
  licenseType: OhioTdddLicenseType;
  licenseNumber: string;
  shipToState: string; // typically "OH" but left editable for demo
}
