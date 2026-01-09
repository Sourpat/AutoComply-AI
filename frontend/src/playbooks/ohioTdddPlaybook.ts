/**
 * Ohio TDDD Playbook
 * 
 * Reviewer checklist and suggested actions for Ohio Terminal Distributor 
 * of Dangerous Drugs (TDDD) license verification.
 * 
 * Step 2.15: Deterministic Evaluators - Reviewer Playbooks
 */

import type { Playbook } from '../types/playbook';

export const ohioTdddPlaybook: Playbook = {
  id: 'ohio_tddd_v1',
  decisionType: 'ohio_tddd',
  title: 'Ohio TDDD License Review',
  description: 'Step-by-step verification checklist for Ohio Terminal Distributor of Dangerous Drugs license applications and renewals.',
  
  steps: [
    {
      id: 'review_submission',
      label: 'Review Application Submission',
      detail: 'Confirm application type (new, renewal, category change), verify all required forms submitted, and check applicant identity.',
      evidenceTags: ['application', 'submission', 'identity'],
      ruleIds: ['ohio_tddd_submission'],
      severity: 'info',
      required: true,
    },
    {
      id: 'validate_tddd_license',
      label: 'Validate TDDD License Status',
      detail: 'Verify Ohio TDDD license is active, valid, and not expired. Check license number format and expiration date.',
      evidenceTags: ['tddd', 'license', 'ohio', 'validity'],
      ruleIds: ['ohio_tddd_license_001'],
      severity: 'block',
      required: true,
    },
    {
      id: 'verify_category_authorization',
      label: 'Verify Category Authorization',
      detail: 'Confirm TDDD category (I, II, III) matches requested controlled substance schedules. Verify category-specific requirements met.',
      evidenceTags: ['category', 'authorization', 'schedules'],
      ruleIds: ['ohio_tddd_category_002'],
      severity: 'block',
      required: true,
    },
    {
      id: 'validate_responsible_pharmacist',
      label: 'Validate Responsible Pharmacist Designation',
      detail: 'Verify designated responsible pharmacist has active Ohio pharmacy license and DEA registration. Confirm pharmacist attestation on file.',
      evidenceTags: ['pharmacist', 'responsible', 'designation', 'license'],
      ruleIds: ['ohio_tddd_rph_003'],
      severity: 'block',
      required: true,
    },
    {
      id: 'inspect_storage_security',
      label: 'Inspect Storage Security Compliance',
      detail: 'Review storage facility security measures: locked cabinets, access controls, surveillance systems. Verify compliance with Ohio Admin. Code 4729:5-3-14.',
      evidenceTags: ['storage', 'security', 'facility', 'compliance'],
      ruleIds: ['ohio_tddd_storage_004'],
      severity: 'review',
      required: true,
    },
    {
      id: 'review_inspection_history',
      label: 'Review Inspection History',
      detail: 'Check recent Ohio Board of Pharmacy inspection findings. Flag critical violations, corrective actions, and compliance timeline.',
      evidenceTags: ['inspection', 'history', 'violations', 'compliance'],
      ruleIds: ['ohio_tddd_inspection_005'],
      severity: 'review',
      required: true,
    },
    {
      id: 'verify_dispensing_protocol',
      label: 'Verify Dispensing Protocol Documentation',
      detail: 'Confirm written dispensing protocols on file: prescription verification, patient counseling, record retention. Check pharmacist oversight procedures.',
      evidenceTags: ['dispensing', 'protocol', 'documentation', 'procedures'],
      ruleIds: ['ohio_tddd_dispensing_006'],
      severity: 'review',
      required: true,
    },
    {
      id: 'validate_wholesale_records',
      label: 'Validate Wholesale Distribution Records',
      detail: 'If applicable, verify wholesale distribution records comply with Ohio Admin. Code 4729:5-3-15. Check record completeness and retention period.',
      evidenceTags: ['wholesale', 'distribution', 'records', 'compliance'],
      ruleIds: ['ohio_tddd_wholesale_007'],
      severity: 'review',
      required: false,
    },
    {
      id: 'check_biennial_renewal',
      label: 'Check Biennial Renewal Status',
      detail: 'Verify TDDD license renewal is current and next renewal date. Flag licenses expiring within 90 days.',
      evidenceTags: ['renewal', 'biennial', 'expiration'],
      ruleIds: ['ohio_tddd_renewal_008'],
      severity: 'info',
      required: true,
    },
    {
      id: 'verify_oarrs_reporting',
      label: 'Verify OARRS Reporting Compliance',
      detail: 'Confirm Ohio Automated Rx Reporting System (OARRS) reporting is current. Check for reporting gaps or late submissions.',
      evidenceTags: ['oarrs', 'reporting', 'pdmp', 'compliance'],
      ruleIds: ['ohio_tddd_reporting_009'],
      severity: 'info',
      required: true,
    },
    {
      id: 'review_staff_training',
      label: 'Review Staff Training Documentation',
      detail: 'Verify staff training records for controlled substance handling, security procedures, and OARRS usage. Confirm annual training completion.',
      evidenceTags: ['training', 'staff', 'documentation', 'compliance'],
      ruleIds: ['ohio_tddd_training_010'],
      severity: 'info',
      required: false,
    },
    {
      id: 'final_disposition',
      label: 'Finalize Disposition & Communicate Decision',
      detail: 'Based on all checks: approve, request additional information, or block. Document decision rationale and notify applicant of outcome.',
      evidenceTags: ['disposition', 'decision', 'communication'],
      severity: 'info',
      required: true,
    },
  ],
  
  suggestedActions: [
    {
      id: 'approve_tddd',
      label: '✅ Approve TDDD License',
      kind: 'APPROVE',
      when: {
        statuses: ['pending_review', 'needs_review'],
        requiresNoBlockers: true,
      },
    },
    {
      id: 'request_license_clarification',
      label: '📋 Request License Clarification',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your Ohio TDDD license:\n\n• Please provide a copy of your current TDDD license certificate\n• Confirm license number: [LICENSE_NUMBER]\n• Verify license category: [CATEGORY]\n• Confirm expiration date is not within 90 days\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_pharmacist_info',
      label: '📋 Request Responsible Pharmacist Information',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your designated responsible pharmacist:\n\n• Please provide pharmacist name and Ohio license number\n• Submit copy of pharmacist license and DEA registration\n• Provide signed attestation from responsible pharmacist\n• Confirm pharmacist availability and oversight schedule\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_storage_compliance',
      label: '📋 Request Storage Security Documentation',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your storage security compliance:\n\n• Please provide facility layout showing secure storage areas\n• Document locked cabinet specifications and access controls\n• Submit surveillance system documentation (if applicable)\n• Confirm compliance with Ohio Admin. Code 4729:5-3-14\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'flag_for_review',
      label: '⚠️ Flag for Senior Review',
      kind: 'NEEDS_REVIEW',
      template: 'This application requires senior reviewer attention due to:\n\n[List specific concerns]\n\nPlease review evidence, inspection history, and fired rules before final disposition.',
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
