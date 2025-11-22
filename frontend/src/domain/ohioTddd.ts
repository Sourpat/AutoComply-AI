export type OhioTdddCustomerResponse =
  | "EXEMPT"
  | "LICENSED_OR_APPLYING";

export interface OhioTdddFormData {
  customerResponse: OhioTdddCustomerResponse | null;
  practitionerName: string;
  stateBoardLicenseNumber: string;
  tdddLicenseNumber?: string | null;
  deaNumber?: string | null;
  tdddLicenseCategory?: string | null;
}

export type OhioTdddDecisionStatus = "ok_to_ship" | "blocked" | "manual_review";

export interface OhioTdddDecision {
  status: OhioTdddDecisionStatus;
  reason: string;
  // keep snake_case to match API JSON
  missing_fields: string[];
}
