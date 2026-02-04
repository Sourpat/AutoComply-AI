/**
 * Submission Types
 * 
 * ============================================================================
 * Step 2.8: End-to-End Submission -> Case Creation -> Connected RAG Evidence
 * ============================================================================
 * 
 * PURPOSE:
 * Track submitted CSF forms and other compliance submissions through the
 * verification workflow. Each submission creates a case in the work queue
 * and connects to RAG evidence for decision support.
 * 
 * LIFECYCLE:
 * 1. User submits CSF form (Practitioner, Hospital, Researcher, etc.)
 * 2. createSubmission() stores form data and generates unique ID
 * 3. Evaluator processes submission -> evaluatorOutput captured
 * 4. Work queue case created with reference to submission ID
 * 5. RAG Explorer can load submission context via traceId or submissionId
 * 6. Verifier reviews case with connected evidence from RAG
 * 
 * DEMO-SAFE IMPLEMENTATION:
 * - localStorage persistence (no backend dependency)
 * - Compatible with existing demoStore work queue items
 * - Supports migration to backend API when ready
 * 
 * ============================================================================
 */

/**
 * Submission Record
 * 
 * Represents a compliance form submission (CSF, license application, etc.)
 * that requires verification and decision-making.
 */
export interface SubmissionRecord {
  /** Unique submission ID (format: SUB-YYYY-NNNNN) */
  id: string;
  
  /** ISO 8601 timestamp when submission was created */
  createdAt: string;
  
  /** ISO 8601 timestamp when submission was last updated (optional) */
  updatedAt?: string;
  
  /** Decision type / CSF form type */
  decisionType: 'csf_practitioner' | 'csf_facility' | 'csf_researcher' | 'ohio_tddd' | 'ny_pharmacy_license' | string;
  
  /** Who submitted the form (optional for demo) */
  submittedBy?: {
    name?: string;
    email?: string;
    role?: string;
  };
  
  /** Account/organization ID (optional) */
  accountId?: string;
  
  /** Location/facility ID (optional) */
  locationId?: string;
  
  /** Structured form data (varies by decision type) */
  formData: Record<string, unknown>;
  
  /** Original raw payload if available */
  rawPayload?: Record<string, unknown>;
  
  /** Output from decision evaluator */
  evaluatorOutput?: {
    /** Overall decision status */
    status?: 'approved' | 'blocked' | 'needs_review';
    
    /** Risk level assessment */
    riskLevel?: 'low' | 'medium' | 'high';
    
    /** Rules that fired during evaluation */
    firedRules?: Array<{
      id: string;
      description: string;
      severity?: string;
    }>;
    
    /** Evidence collected during evaluation */
    evidence?: Array<{
      id: string;
      source: string;
      snippet?: string;
      tags?: string[];
    }>;
    
    /** Missing evidence or information */
    missingEvidence?: string[];
    
    /** Confidence score (0-100) */
    confidence?: number;
    
    /** Human-readable explanation */
    explanation?: string;
    
    /** Trace ID for debugging/replay */
    traceId?: string;
  };
  
  /** Soft delete flag */
  isDeleted?: boolean;
  
  /** ISO 8601 timestamp when submission was deleted (optional) */
  deletedAt?: string;
}

/**
 * Input type for creating new submissions (omits auto-generated fields)
 */
export type CreateSubmissionInput = Omit<SubmissionRecord, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'>;

/**
 * Submission list item (for display in lists/tables)
 */
export interface SubmissionListItem {
  id: string;
  createdAt: string;
  decisionType: string;
  submittedBy?: string;
  status?: 'approved' | 'blocked' | 'needs_review' | 'pending';
  riskLevel?: 'low' | 'medium' | 'high';
}

export type CompletenessCategory = "block" | "review" | "info";

export type CompletenessField = {
  path: string | string[];
  label: string;
  category: CompletenessCategory;
};

export type CompletenessSchema = {
  key: string;
  label: string;
  fields: CompletenessField[];
};

export const completenessSchemas: Record<string, CompletenessSchema> = {
  default: {
    key: "default",
    label: "Generic submission",
    fields: [
      { path: ["submission_id", "id"], label: "Submission ID", category: "info" },
      { path: ["decision_type", "decisionType"], label: "Decision Type", category: "info" },
      { path: ["created_at", "createdAt"], label: "Created At", category: "info" },
    ],
  },
  csf_practitioner: {
    key: "csf_practitioner",
    label: "CSF Practitioner",
    fields: [
      { path: ["practitioner_name", "practitionerName", "name"], label: "Practitioner Name", category: "block" },
      { path: ["dea_number", "deaNumber"], label: "DEA Number", category: "block" },
      { path: ["state", "state_code"], label: "State", category: "block" },
      { path: ["state_license_number", "stateLicenseNumber"], label: "State License Number", category: "block" },
      { path: ["state_license_expiration", "stateLicenseExpiration"], label: "State License Expiration", category: "review" },
      { path: ["npi", "npi_number"], label: "NPI Number", category: "review" },
      { path: ["authorized_schedules", "authorizedSchedules"], label: "Authorized Schedules", category: "review" },
      { path: ["requested_schedule", "requestedSchedules"], label: "Requested Schedule", category: "review" },
      { path: ["attestation_complete", "attestationComplete"], label: "Attestation Complete", category: "info" },
      { path: ["attestation_date", "attestationDate"], label: "Attestation Date", category: "info" },
    ],
  },
  csf_facility: {
    key: "csf_facility",
    label: "CSF Facility",
    fields: [
      { path: ["facility_name", "facilityName"], label: "Facility Name", category: "block" },
      { path: ["facility_type", "facilityType"], label: "Facility Type", category: "block" },
      { path: ["state", "state_code"], label: "State", category: "block" },
      { path: ["dea_number", "facility_dea_number", "deaNumber"], label: "DEA Number", category: "block" },
      { path: ["tddd_certificate_number", "tddd_certificate", "tdddCertificateNumber"], label: "TDDD Certificate", category: "block" },
      { path: ["tddd_expiration", "tddd_expiry"], label: "TDDD Expiration", category: "review" },
      { path: ["responsible_person", "responsiblePerson"], label: "Responsible Person", category: "review" },
      { path: ["storage_controls", "storageControls"], label: "Storage Controls", category: "review" },
      { path: ["diversion_plan", "diversionPlan"], label: "Diversion Plan", category: "info" },
    ],
  },
  csf_hospital: {
    key: "csf_hospital",
    label: "CSF Hospital",
    fields: [
      { path: ["hospital_name", "facility_name", "facilityName"], label: "Hospital Name", category: "block" },
      { path: ["state", "state_code"], label: "State", category: "block" },
      { path: ["facility_dea_number", "dea_number", "deaNumber"], label: "DEA Number", category: "block" },
      { path: ["tddd_certificate_number", "tddd_certificate", "tdddCertificateNumber"], label: "TDDD Certificate", category: "block" },
      { path: ["tddd_expiration", "tddd_expiry"], label: "TDDD Expiration", category: "review" },
      { path: ["authorized_schedules", "authorizedSchedules"], label: "Authorized Schedules", category: "review" },
      { path: ["attestation_complete", "attestationComplete"], label: "Attestation Complete", category: "info" },
    ],
  },
  ohio_tddd: {
    key: "ohio_tddd",
    label: "Ohio TDDD",
    fields: [
      { path: ["facility_name", "facilityName"], label: "Facility Name", category: "block" },
      { path: ["tddd_certificate_number", "tddd_certificate", "tdddCertificateNumber"], label: "TDDD Certificate", category: "block" },
      { path: ["tddd_expiration", "tddd_expiry"], label: "TDDD Expiration", category: "review" },
      { path: ["state", "state_code"], label: "State", category: "review" },
      { path: ["responsible_person", "responsiblePerson"], label: "Responsible Person", category: "info" },
    ],
  },
};
