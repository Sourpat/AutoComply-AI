/**
 * Decision Type Resolver Utility
 * 
 * Provides logic to determine the decision type for a case from various sources.
 * Used when calling intelligence endpoints that accept decision_type parameter.
 */

import { CaseRecord } from '../api/workflowApi';

/**
 * Resolve decision type from case and submission data
 * 
 * Priority:
 * 1. case.decisionType (if present and not empty)
 * 2. submission.form_type (if submission present)
 * 3. Fallback: 'csf' (most common default)
 * 
 * @param caseData - The case record
 * @param submissionFormType - Optional form_type from submission
 * @returns Decision type string (e.g., 'csf', 'csf_practitioner', 'license_renewal')
 */
export function resolveDecisionType(
  caseData?: CaseRecord | null,
  submissionFormType?: string | null
): string {
  // Priority 1: Case decision type
  if (caseData?.decisionType && caseData.decisionType.trim() !== '') {
    return caseData.decisionType;
  }

  // Priority 2: Submission form type
  if (submissionFormType && submissionFormType.trim() !== '') {
    return submissionFormType;
  }

  // Fallback: Default to CSF (Controlled Substance Form)
  return 'csf';
}

/**
 * Map form type to decision type
 * 
 * Some submissions have form_type values that need to be mapped to
 * intelligence decision types.
 * 
 * @param formType - The submission form type
 * @returns Mapped decision type
 */
export function mapFormTypeToDecisionType(formType: string): string {
  const mapping: Record<string, string> = {
    'csf': 'csf',
    'csf_practitioner': 'csf_practitioner',
    'csf_facility': 'csf_facility',
    'csf_researcher': 'csf_researcher',
    'csa': 'csa',
    'license_renewal': 'license_renewal',
    'export_permit': 'export_permit',
    // Add more mappings as needed
  };

  return mapping[formType.toLowerCase()] || formType;
}
