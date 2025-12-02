export interface OhioHospitalOrderApprovalResult {
  csf_status: string;
  csf_reason: string;
  csf_missing_fields: string[];

  tddd_status?: string | null;
  tddd_reason?: string | null;
  tddd_missing_fields?: string[] | null;

  final_decision: string;
  notes: string[];
}
