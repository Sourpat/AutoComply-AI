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
