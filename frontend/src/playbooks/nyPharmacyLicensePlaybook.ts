/**
 * NY Pharmacy License Playbook
 * 
 * Reviewer checklist and suggested actions for New York pharmacy license
 * verification and renewal under NY Education Law and NYCRR regulations.
 * 
 * Step 2.15: Deterministic Evaluators - Reviewer Playbooks
 */

import type { Playbook } from '../types/playbook';

export const nyPharmacyLicensePlaybook: Playbook = {
  id: 'ny_pharmacy_license_v1',
  decisionType: 'ny_pharmacy_license',
  title: 'NY Pharmacy License Review',
  description: 'Step-by-step verification checklist for New York pharmacy license applications, renewals, and registration updates.',
  
  steps: [
    {
      id: 'review_submission',
      label: 'Review Application Submission',
      detail: 'Confirm application type (new license, renewal, registration update), verify all required forms submitted, and check pharmacy identity.',
      evidenceTags: ['application', 'submission', 'identity'],
      ruleIds: ['ny_pharm_submission'],
      severity: 'info',
      required: true,
    },
    {
      id: 'validate_pharmacy_license',
      label: 'Validate NY Pharmacy License',
      detail: 'Verify New York pharmacy license is active, valid, and not expired. Check license number format and expiration date (triennial renewal).',
      evidenceTags: ['pharmacy', 'license', 'ny', 'validity'],
      ruleIds: ['ny_pharm_license_001'],
      severity: 'block',
      required: true,
    },
    {
      id: 'verify_pharmacist_in_charge',
      label: 'Verify Pharmacist-in-Charge (PIC)',
      detail: 'Confirm designated pharmacist-in-charge has active NY pharmacist license in good standing. Verify PIC attestation and oversight responsibilities.',
      evidenceTags: ['pharmacist', 'pic', 'designation', 'license'],
      ruleIds: ['ny_pharm_pharmacist_002'],
      severity: 'block',
      required: true,
    },
    {
      id: 'validate_nysdoh_registration',
      label: 'Validate NYSDOH Registration',
      detail: 'Verify New York State Department of Health registration is current and valid. Check registration expiration date.',
      evidenceTags: ['nysdoh', 'registration', 'health department'],
      ruleIds: ['ny_pharm_registration_003'],
      severity: 'block',
      required: true,
    },
    {
      id: 'verify_bne_registration',
      label: 'Verify BNE Controlled Substance Registration',
      detail: 'Confirm New York Bureau of Narcotic Enforcement (BNE) registration is active. Required for dispensing controlled substances.',
      evidenceTags: ['bne', 'controlled', 'registration', 'narcotic'],
      ruleIds: ['ny_pharm_controlled_004'],
      severity: 'block',
      required: true,
    },
    {
      id: 'inspect_facility_standards',
      label: 'Inspect Facility Standards Compliance',
      detail: 'Review facility inspection reports for compliance with NY Education Law §6808 and 8 NYCRR §63.6. Flag critical violations and corrective actions.',
      evidenceTags: ['facility', 'inspection', 'standards', 'compliance'],
      ruleIds: ['ny_pharm_facility_005'],
      severity: 'review',
      required: true,
    },
    {
      id: 'verify_istop_compliance',
      label: 'Verify I-STOP PDMP Compliance',
      detail: 'Confirm Internet System for Tracking Over-Prescribing (I-STOP) compliance. Check for PDMP reporting violations or gaps.',
      evidenceTags: ['istop', 'pdmp', 'reporting', 'compliance'],
      ruleIds: ['ny_pharm_pdmp_006'],
      severity: 'review',
      required: true,
    },
    {
      id: 'check_staffing_ratios',
      label: 'Check Pharmacist-Technician Staffing Ratios',
      detail: 'Verify pharmacist-to-technician ratios comply with 8 NYCRR §63.6(b)(6). Confirm adequate pharmacist supervision.',
      evidenceTags: ['staffing', 'ratio', 'technician', 'supervision'],
      ruleIds: ['ny_pharm_staffing_007'],
      severity: 'review',
      required: true,
    },
    {
      id: 'validate_prescription_records',
      label: 'Validate Prescription Record Retention',
      detail: 'Verify prescription records are complete, organized, and retained per NY Education Law §6810. Check electronic record systems if applicable.',
      evidenceTags: ['records', 'prescription', 'retention', 'documentation'],
      ruleIds: ['ny_pharm_records_008'],
      severity: 'review',
      required: true,
    },
    {
      id: 'verify_compounding_registration',
      label: 'Verify Compounding Registration (if applicable)',
      detail: 'If pharmacy performs compounding, verify additional registration and compliance with 8 NYCRR Part 63. Check sterile compounding certifications.',
      evidenceTags: ['compounding', 'registration', 'sterile', 'certification'],
      ruleIds: ['ny_pharm_compounding_009'],
      severity: 'review',
      required: false,
    },
    {
      id: 'check_triennial_renewal',
      label: 'Check Triennial Renewal Status',
      detail: 'Verify pharmacy license triennial renewal is current. Flag licenses expiring within 120 days and remind of renewal requirements.',
      evidenceTags: ['renewal', 'triennial', 'expiration'],
      ruleIds: ['ny_pharm_renewal_010'],
      severity: 'info',
      required: true,
    },
    {
      id: 'final_disposition',
      label: 'Finalize Disposition & Communicate Decision',
      detail: 'Based on all checks: approve, request additional information, or block. Document decision rationale and notify pharmacy of outcome.',
      evidenceTags: ['disposition', 'decision', 'communication'],
      severity: 'info',
      required: true,
    },
  ],
  
  suggestedActions: [
    {
      id: 'approve_license',
      label: '✅ Approve Pharmacy License',
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
      template: 'We need additional information regarding your NY pharmacy license:\n\n• Please provide a copy of your current pharmacy license certificate\n• Confirm license number: [LICENSE_NUMBER]\n• Verify triennial renewal date\n• Confirm expiration date is not within 120 days\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_pic_info',
      label: '📋 Request Pharmacist-in-Charge Information',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your pharmacist-in-charge:\n\n• Please provide PIC name and NY pharmacist license number\n• Submit copy of PIC license certificate\n• Provide signed PIC attestation and oversight responsibilities\n• Confirm PIC availability and supervision schedule\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_registration_info',
      label: '📋 Request NYSDOH/BNE Registration Documents',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your NYSDOH and BNE registrations:\n\n• Please provide copy of NYSDOH registration certificate\n• Submit copy of BNE controlled substance registration\n• Verify registration numbers and expiration dates\n• Confirm both registrations are active and in good standing\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'request_istop_compliance',
      label: '📋 Request I-STOP Compliance Documentation',
      kind: 'REQUEST_INFO',
      template: 'We need additional information regarding your I-STOP PDMP compliance:\n\n• Please provide evidence of I-STOP registration and usage\n• Document recent PDMP queries and reporting compliance\n• Address any flagged violations or reporting gaps\n• Submit pharmacist I-STOP training certificates\n\nPlease upload documents to the application portal within 5 business days.',
      when: {
        statuses: ['pending_review', 'needs_review'],
      },
    },
    {
      id: 'flag_for_review',
      label: '⚠️ Flag for Senior Review',
      kind: 'NEEDS_REVIEW',
      template: 'This application requires senior reviewer attention due to:\n\n[List specific concerns]\n\nPlease review evidence, inspection reports, and fired rules before final disposition.',
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
