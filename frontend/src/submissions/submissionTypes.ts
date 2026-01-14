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
