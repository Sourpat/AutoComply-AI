/**
 * Rule Expectations Mapping
 * 
 * Defines required evidence fields and trigger conditions for each regulatory rule.
 * Used for completeness scoring and counterfactual generation.
 */

export interface RuleExpectation {
  ruleId: string;
  title: string;
  severity: 'block' | 'review' | 'info';
  requiredEvidence: string[];
  triggerConditionSummary: string;
  jurisdiction?: string;
  citation?: string;
}

/**
 * CSF Practitioner Rule Expectations
 */
export const CSF_PRACTITIONER_RULE_EXPECTATIONS: RuleExpectation[] = [
  {
    ruleId: 'csf-prac-dea-required',
    title: 'DEA Number Required',
    severity: 'block',
    requiredEvidence: ['dea_number', 'dea_expiry'],
    triggerConditionSummary: 'Triggers when DEA number is missing or expired',
    jurisdiction: 'Federal',
    citation: '21 CFR §1301.13'
  },
  {
    ruleId: 'csf-prac-state-license-required',
    title: 'State License Required',
    severity: 'block',
    requiredEvidence: ['state_license_number', 'state_license_expiry', 'state'],
    triggerConditionSummary: 'Triggers when state license is missing or expired',
    jurisdiction: 'State',
    citation: 'State-specific'
  },
  {
    ruleId: 'csf-prac-ohio-tddd-required',
    title: 'Ohio TDDD Certificate Required',
    severity: 'block',
    requiredEvidence: ['state', 'tddd_certificate', 'tddd_expiry'],
    triggerConditionSummary: 'Triggers when practitioner operates in Ohio without valid TDDD certificate',
    jurisdiction: 'OH',
    citation: 'Ohio Rev. Code §3719.061'
  },
  {
    ruleId: 'csf-prac-schedule-authorization',
    title: 'Schedule Authorization Required',
    severity: 'review',
    requiredEvidence: ['dea_number', 'authorized_schedules', 'requested_schedule'],
    triggerConditionSummary: 'Triggers when practitioner is not authorized for requested controlled substance schedule',
    jurisdiction: 'Federal',
    citation: '21 CFR §1306.04'
  },
  {
    ruleId: 'csf-prac-attestation-required',
    title: 'CSF Attestation Required',
    severity: 'review',
    requiredEvidence: ['attestation_complete', 'attestation_date'],
    triggerConditionSummary: 'Triggers when CSF attestation is missing or outdated (>90 days)',
    jurisdiction: 'Federal',
    citation: 'Internal Policy'
  },
  {
    ruleId: 'csf-prac-npi-verification',
    title: 'NPI Verification',
    severity: 'info',
    requiredEvidence: ['npi', 'practitioner_name'],
    triggerConditionSummary: 'Triggers when NPI is missing or does not match NPPES registry',
    jurisdiction: 'Federal',
    citation: 'CMS NPPES'
  },
  {
    ruleId: 'csf-prac-telemedicine-ryan-haight',
    title: 'Ryan Haight Act - Telemedicine Exception',
    severity: 'block',
    requiredEvidence: ['is_telemedicine', 'dea_number', 'telemedicine_certification'],
    triggerConditionSummary: 'Triggers when telemedicine prescription lacks proper DEA certification',
    jurisdiction: 'Federal',
    citation: '21 USC §829(e)'
  },
  {
    ruleId: 'csf-prac-prescribing-limits',
    title: 'State Prescribing Limits',
    severity: 'review',
    requiredEvidence: ['state', 'requested_quantity', 'requested_schedule'],
    triggerConditionSummary: 'Triggers when requested quantity exceeds state-specific prescribing limits',
    jurisdiction: 'State',
    citation: 'State-specific'
  }
];

/**
 * Facility CSF Rule Expectations
 */
export const CSF_FACILITY_RULE_EXPECTATIONS: RuleExpectation[] = [
  {
    ruleId: 'csf-hosp-dea-required',
    title: 'Hospital DEA Registration Required',
    severity: 'block',
    requiredEvidence: ['facility_dea_number', 'facility_dea_expiry'],
    triggerConditionSummary: 'Triggers when hospital DEA registration is missing or expired',
    jurisdiction: 'Federal',
    citation: '21 CFR §1301.13'
  },
  {
    ruleId: 'csf-hosp-ohio-tddd-required',
    title: 'Ohio Hospital TDDD Certificate Required',
    severity: 'block',
    requiredEvidence: ['facility_state', 'facility_tddd_certificate', 'facility_tddd_expiry'],
    triggerConditionSummary: 'Triggers when Ohio hospital lacks valid TDDD certificate',
    jurisdiction: 'OH',
    citation: 'Ohio Rev. Code §3719.061'
  },
  {
    ruleId: 'csf-hosp-category-verification',
    title: 'TDDD Category Verification',
    severity: 'review',
    requiredEvidence: ['facility_tddd_certificate', 'tddd_category', 'requested_substance'],
    triggerConditionSummary: 'Triggers when TDDD category does not authorize requested substance',
    jurisdiction: 'OH',
    citation: 'Ohio Admin. Code §4729:6-3-01'
  }
];

/**
 * Get all rule expectations for a given CSF type
 */
export function getRuleExpectations(csfType: string): RuleExpectation[] {
  const normalizedType = csfType?.toLowerCase() || '';
  
  if (normalizedType.includes('practitioner')) {
    return CSF_PRACTITIONER_RULE_EXPECTATIONS;
  } else if (normalizedType.includes('hospital') || normalizedType.includes('facility')) {
    return CSF_FACILITY_RULE_EXPECTATIONS;
  }
  
  // Default to practitioner rules
  return CSF_PRACTITIONER_RULE_EXPECTATIONS;
}

/**
 * Get required fields for a CSF type (for completeness scoring)
 */
export function getRequiredFields(csfType: string): string[] {
  const rules = getRuleExpectations(csfType);
  const allFields = rules.flatMap(rule => rule.requiredEvidence);
  
  // Deduplicate
  return Array.from(new Set(allFields));
}

/**
 * Get rule expectation by ID
 */
export function getRuleExpectationById(ruleId: string): RuleExpectation | undefined {
  const allRules = [
    ...CSF_PRACTITIONER_RULE_EXPECTATIONS,
    ...CSF_FACILITY_RULE_EXPECTATIONS
  ];
  
  return allRules.find(rule => rule.ruleId === ruleId);
}
