export type OhioTdddDecisionStatus =
  | "approved"
  | "blocked"
  | "manual_review";

export interface OhioTdddDecision {
  status: OhioTdddDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
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
