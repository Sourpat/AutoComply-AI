/**
 * CSF Practitioner Playbook
 * 
 * Reviewer checklist and suggested actions for DEA CSF (Controlled Substance
 * Facilitator) verification for individual practitioners.
 * 
 * Step 2.6: Reviewer Playbooks
 */

import type { Playbook } from '../types/playbook';

export const csfPractitionerPlaybook: Playbook = {
  id: 'csf_practitioner_v1',
  decisionType: 'csf_practitioner',
  title: 'DEA CSF Practitioner Review',
  description: 'Step-by-step verification checklist for DEA Controlled Substance Facilitator applications from individual practitioners (physicians, NPs, PAs).',
  
  steps: [
    {
      id: 'dea_registration',
      label: 'Validate DEA Registration Number',
      detail: 'Verify DEA registration is active, matches practitioner name, and covers controlled substance schedules.',
      evidenceTags: ['dea', 'registration', 'federal'],
      ruleIds: ['R_DEA_REQUIRED', 'R_DEA_FORMAT', 'R_DEA_VALID'],
      severity: 'block',
      required: true,
    },
    {
      id: 'state_license',
      label: 'Validate State Medical License',
      detail: 'Confirm state license number is active, matches jurisdiction, and authorizes controlled substance prescribing.',
      evidenceTags: ['license', 'state', 'medical'],
      ruleIds: ['R_STATE_LICENSE_REQUIRED', 'R_LICENSE_VALID', 'R_LICENSE_ACTIVE'],
      severity: 'block',
      required: true,
    },
    {
      id: 'schedules_attestation',
      label: 'Verify Controlled Substance Schedules Attestation',
      detail: 'Practitioner must attest to handling schedules II-V. Check for missing or incomplete attestations.',
      evidenceTags: ['schedule', 'attestation', 'controlled'],
      ruleIds: ['R_SCHEDULES_REQUIRED', 'R_SCHEDULE_II_ATTESTATION'],
      severity: 'block',
      required: true,
    },
    {
      id: 'expiration_dates',
      label: 'Check License & Registration Expirations',
      detail: 'DEA registration and state license must not expire within 60 days. Flag renewals needed.',
      evidenceTags: ['expiration', 'renewal', 'validity'],
      ruleIds: ['R_DEA_EXPIRY_WARNING', 'R_LICENSE_EXPIRY'],
      severity: 'review',
      required: true,
    },
    {
      id: 'telemedicine_attestation',
      label: 'Validate Telemedicine Attestation (if applicable)',
      detail: 'If practitioner intends to facilitate telemedicine prescriptions, verify telemedicine license and attestation.',
      evidenceTags: ['telemedicine', 'attestation', 'remote'],
      ruleIds: ['R_TELEMEDICINE_REQUIRED', 'R_TELEMEDICINE_LICENSE'],
      severity: 'review',
      required: false,
    },
    {
      id: 'facility_restrictions',
      label: 'Confirm Facility/Practice Restrictions',
      detail: 'Check for facility-based restrictions (e.g., hospital-only privileges). CSF typically requires storefront or private practice.',
      evidenceTags: ['facility', 'practice', 'restriction'],
      ruleIds: ['R_FACILITY_TYPE', 'R_PRACTICE_LOCATION'],
      severity: 'review',
      required: false,
    },
    {
      id: 'npi_validation',
      label: 'Validate NPI Number',
      detail: 'Confirm NPI (National Provider Identifier) matches practitioner name and is active in NPPES.',
      evidenceTags: ['npi', 'identity', 'nppes'],
      ruleIds: ['R_NPI_REQUIRED', 'R_NPI_FORMAT'],
      severity: 'info',
      required: true,
    },
    {
      id: 'name_identity_match',
      label: 'Verify Name & Identity Consistency',
      detail: 'All documents (DEA, state license, NPI) must match practitioner legal name. Flag discrepancies.',
      evidenceTags: ['name', 'identity', 'match'],
      ruleIds: ['R_NAME_MATCH', 'R_IDENTITY_VERIFIED'],
      severity: 'info',
      required: true,
    },
    {
      id: 'specialty_verification',
      label: 'Verify Medical Specialty (Optional)',
      detail: 'Confirm specialty aligns with controlled substance prescribing (e.g., pain management, oncology). Flag unusual specialties.',
      evidenceTags: ['specialty', 'credentials'],
      ruleIds: ['R_SPECIALTY_CHECK'],
      severity: 'info',
      required: false,
    },
    {
      id: 'sanctions_check',
      label: 'Check for Sanctions/Disciplinary Actions',
      detail: 'Search state medical board, OIG exclusion list, and SAM.gov for sanctions or disciplinary history.',
      evidenceTags: ['sanctions', 'exclusion', 'discipline'],
      ruleIds: ['R_SANCTIONS_CHECK', 'R_OIG_EXCLUSION'],
      severity: 'review',
      required: true,
    },
    {
      id: 'documentation_completeness',
      label: 'Confirm All Required Documentation Uploaded',
      detail: 'Verify all required PDFs/images (DEA cert, license copy, attestation forms) are present and legible.',
      evidenceTags: ['documentation', 'upload', 'complete'],
      ruleIds: ['R_DOCS_REQUIRED', 'R_ATTESTATION_FORM'],
      severity: 'review',
      required: true,
    },
    {
      id: 'final_disposition',
      label: 'Finalize Disposition & Communicate Next Steps',
      detail: 'Based on all checks: approve, request additional info, or block. Document decision rationale and notify applicant.',
      evidenceTags: ['disposition', 'communication'],
      severity: 'info',
      required: true,
    },
  ],
  
  suggestedActions: [
    {
      id: 'approve_csf',
      label: '✅ Approve CSF Application',
      kind: 'APPROVE',
      when: {
        statuses: ['pending_review', 'needs_review'],
        requiresNoBlockers: true,
      },
    },
    {
      id: 'request_dea_clarification',
      label: '📋 Request DEA Registration Clarification',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your DEA registration:\n\n• Please provide a copy of your current DEA certificate\n• Confirm your DEA number matches: [DEA_NUMBER]\n• Verify expiration date is not within 60 days\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_license_info',
      label: '📋 Request State License Information',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your state medical license:\n\n• Please provide a copy of your current state license\n• Confirm license number: [LICENSE_NUMBER]\n• Verify controlled substance prescribing authority\n• Confirm expiration date\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'flag_for_review',
      label: '⚠️ Flag for Senior Review',
      kind: 'NEEDS_REVIEW',
      template: 'This application requires senior reviewer attention due to:\n\n[List specific concerns]\n\nPlease review evidence and fired rules before final disposition.',
      when: {
        statuses: ['pending_review'],
      },
    },
    {
      id: 'block_application',
      label: '⛔ Block Application',
      kind: 'BLOCK',
      template: 'This application is blocked due to:\n\n[List blocking issues]\n\nApplicant will be notified and may resubmit after addressing all issues.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'add_review_note',
      label: '📝 Add Review Note',
      kind: 'ADD_NOTE',
      template: 'Reviewer note: ',
      when: {
        statuses: ['pending_review', 'needs_review', 'approved', 'blocked'],
      },
    },
  ],
};
