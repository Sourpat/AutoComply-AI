/**
 * CSF Facility Playbook
 * 
 * Reviewer checklist and suggested actions for hospital/facility DEA CSF 
 * (Controlled Substance Facilitator) verification and controlled substance 
 * handling authorization.
 * 
 * Step 2.15: Deterministic Evaluators - Reviewer Playbooks
 */

import type { Playbook } from '../types/playbook';

export const csfFacilityPlaybook: Playbook = {
  id: 'csf_facility_v1',
  decisionType: 'csf_facility',
  title: 'DEA CSF Facility Review',
  description: 'Step-by-step verification checklist for DEA Controlled Substance Facilitator applications from hospitals, clinics, and healthcare facilities.',
  
  steps: [
    {
      id: 'review_submission',
      label: 'Review Facility Application Submission',
      detail: 'Confirm application type (new, renewal, facility expansion), verify all required institutional forms submitted, and validate facility identity.',
      evidenceTags: ['application', 'submission', 'facility', 'identity'],
      ruleIds: ['csf_facility_submission'],
      severity: 'info',
      required: true,
    },
    {
      id: 'validate_facility_dea',
      label: 'Validate Facility DEA Registration',
      detail: 'Verify facility DEA registration is active, valid, and covers all controlled substance schedules. Check registration number format and expiration date.',
      evidenceTags: ['dea', 'registration', 'facility', 'federal'],
      ruleIds: ['csf_facility_dea_001'],
      severity: 'block',
      required: true,
    },
    {
      id: 'validate_state_license',
      label: 'Validate State Facility License',
      detail: 'Confirm state healthcare facility license (hospital, clinic, ambulatory surgery center) is active and authorizes controlled substance storage/administration.',
      evidenceTags: ['license', 'state', 'facility', 'healthcare'],
      ruleIds: ['csf_facility_state_002'],
      severity: 'block',
      required: true,
    },
    {
      id: 'verify_responsible_person',
      label: 'Verify Designated Responsible Person',
      detail: 'Confirm facility has designated responsible pharmacist or physician with active license and DEA registration. Verify oversight authority and attestation.',
      evidenceTags: ['responsible', 'pharmacist', 'physician', 'designation'],
      ruleIds: ['csf_facility_responsible_003'],
      severity: 'block',
      required: true,
    },
    {
      id: 'inspect_storage_security',
      label: 'Inspect Storage Security Compliance',
      detail: 'Review storage security measures: locked cabinets/carts, pharmacy safes, automated dispensing cabinets (Pyxis/Omnicell). Verify DEA security requirements.',
      evidenceTags: ['storage', 'security', 'compliance', 'adc'],
      ruleIds: ['csf_facility_storage_004'],
      severity: 'block',
      required: true,
    },
    {
      id: 'validate_recordkeeping',
      label: 'Validate Recordkeeping System',
      detail: 'Verify controlled substance recordkeeping system (electronic health records, pharmacy system) complies with DEA retention requirements (2+ years).',
      evidenceTags: ['recordkeeping', 'ehr', 'pharmacy', 'retention'],
      ruleIds: ['csf_facility_recordkeeping_005'],
      severity: 'block',
      required: true,
    },
    {
      id: 'check_biennial_inventory',
      label: 'Check Biennial Inventory Compliance',
      detail: 'Verify facility conducts biennial controlled substance inventory per DEA requirements. Review most recent inventory records and discrepancy reports.',
      evidenceTags: ['inventory', 'biennial', 'dea', 'compliance'],
      ruleIds: ['csf_facility_inventory_006'],
      severity: 'review',
      required: true,
    },
    {
      id: 'review_diversion_program',
      label: 'Review Diversion Prevention Program',
      detail: 'Confirm facility has written diversion prevention policies: employee screening, access monitoring, discrepancy investigation, and reporting procedures.',
      evidenceTags: ['diversion', 'prevention', 'policy', 'monitoring'],
      ruleIds: ['csf_facility_diversion_007'],
      severity: 'review',
      required: true,
    },
    {
      id: 'verify_staff_training',
      label: 'Verify Staff Training Documentation',
      detail: 'Verify nursing, pharmacy, and provider staff receive annual controlled substance training: handling, documentation, security, and diversion awareness.',
      evidenceTags: ['training', 'staff', 'documentation', 'compliance'],
      ruleIds: ['csf_facility_staff_008'],
      severity: 'review',
      required: true,
    },
    {
      id: 'validate_theft_procedures',
      label: 'Validate Theft/Loss Reporting Procedures',
      detail: 'Confirm facility has documented procedures for reporting controlled substance theft or significant loss to DEA within required timeframe (1 business day).',
      evidenceTags: ['theft', 'loss', 'reporting', 'procedures'],
      ruleIds: ['csf_facility_theft_009'],
      severity: 'review',
      required: true,
    },
    {
      id: 'review_inspection_history',
      label: 'Review DEA/State Inspection History',
      detail: 'Check recent DEA and state pharmacy/health department inspection findings. Flag critical violations, corrective action plans, and compliance status.',
      evidenceTags: ['inspection', 'history', 'violations', 'compliance'],
      ruleIds: ['csf_facility_inspection_010'],
      severity: 'review',
      required: true,
    },
    {
      id: 'check_dea_renewal',
      label: 'Check DEA Registration Renewal Status',
      detail: 'Verify facility DEA registration renewal is current. Flag registrations expiring within 90 days and remind of renewal requirements.',
      evidenceTags: ['renewal', 'dea', 'expiration'],
      ruleIds: ['csf_facility_renewal_011'],
      severity: 'info',
      required: true,
    },
    {
      id: 'final_disposition',
      label: 'Finalize Disposition & Communicate Decision',
      detail: 'Based on all checks: approve, request additional information, or block. Document decision rationale and notify facility of outcome.',
      evidenceTags: ['disposition', 'decision', 'communication'],
      severity: 'info',
      required: true,
    },
  ],
  
  suggestedActions: [
    {
      id: 'approve_csf_facility',
      label: '✅ Approve CSF Facility Application',
      kind: 'APPROVE',
      when: {
        statuses: ['pending_review', 'needs_review'],
        requiresNoBlockers: true,
      },
    },
    {
      id: 'request_dea_info',
      label: '📋 Request Facility DEA Registration Information',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your facility DEA registration:\n\n• Please provide a copy of your current facility DEA certificate\n• Confirm DEA registration number: [DEA_NUMBER]\n• Verify all controlled substance schedules are covered\n• Confirm expiration date is not within 90 days\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_license_info',
      label: '📋 Request State Facility License Information',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your state facility license:\n\n• Please provide a copy of your current state license certificate\n• Confirm license number and facility type\n• Verify controlled substance authorization\n• Confirm expiration date and renewal status\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_responsible_person_info',
      label: '📋 Request Responsible Person Documentation',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your designated responsible person:\n\n• Please provide name, title, and license number\n• Submit copy of responsible person DEA registration and license\n• Provide signed attestation and oversight responsibilities\n• Confirm availability and supervision structure\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_storage_compliance',
      label: '📋 Request Storage Security Documentation',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your storage security compliance:\n\n• Please provide facility layout showing secure storage locations\n• Document locked cabinet/safe specifications and access controls\n• Submit automated dispensing cabinet (ADC) inventory and security settings\n• Confirm compliance with DEA security requirements\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_diversion_program',
      label: '📋 Request Diversion Prevention Program Documentation',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your diversion prevention program:\n\n• Please provide written diversion prevention policies and procedures\n• Submit employee screening and access control documentation\n• Document discrepancy investigation and reporting procedures\n• Provide recent audit reports and corrective actions\n\nPlease upload documents to the application portal within 5 business days.',
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
