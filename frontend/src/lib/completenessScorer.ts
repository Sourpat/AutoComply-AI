/**
 * Completeness Scorer
 * 
 * Calculates data completeness based on required fields for CSF type
 */

import { getRuleExpectations, type RuleExpectation } from './ruleExpectations';

export interface CompletenessScore {
  scorePct: number;
  presentCount: number;
  totalCount: number;
  missing: {
    block: string[];
    review: string[];
    info: string[];
  };
  missingFieldDetails: Array<{
    field: string;
    severity: 'block' | 'review' | 'info';
    requiredBy: string; // rule title
  }>;
}

/**
 * Check if a field value is present and non-empty
 */
function isFieldPresent(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true; // booleans always count as present
  if (typeof value === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Calculate completeness score for a submission payload
 */
export function calculateCompleteness(
  payload: Record<string, any>,
  csfType: string
): CompletenessScore {
  const rules = getRuleExpectations(csfType);
  
  // Build a map of field -> rules that require it
  const fieldToRules = new Map<string, RuleExpectation[]>();
  
  rules.forEach(rule => {
    rule.requiredEvidence.forEach(field => {
      if (!fieldToRules.has(field)) {
        fieldToRules.set(field, []);
      }
      fieldToRules.get(field)!.push(rule);
    });
  });
  
  // Get unique required fields
  const requiredFields = Array.from(fieldToRules.keys());
  
  // Check which fields are present
  const presentFields: string[] = [];
  const missingFields: string[] = [];
  
  requiredFields.forEach(field => {
    const value = payload[field];
    if (isFieldPresent(value)) {
      presentFields.push(field);
    } else {
      missingFields.push(field);
    }
  });
  
  // Group missing fields by severity
  const missingByRules = missingFields.map(field => {
    const requiringRules = fieldToRules.get(field) || [];
    
    // Find the highest severity rule that requires this field
    let highestSeverity: 'block' | 'review' | 'info' = 'info';
    let requiredByRule = requiringRules[0];
    
    for (const rule of requiringRules) {
      if (rule.severity === 'block') {
        highestSeverity = 'block';
        requiredByRule = rule;
        break;
      } else if (rule.severity === 'review') {
        if (highestSeverity === 'info') {
          highestSeverity = 'review';
          requiredByRule = rule;
        }
      }
    }
    
    return {
      field,
      severity: highestSeverity,
      requiredBy: requiredByRule?.title || 'Unknown rule'
    };
  });
  
  const missing = {
    block: missingByRules.filter(m => m.severity === 'block').map(m => m.field),
    review: missingByRules.filter(m => m.severity === 'review').map(m => m.field),
    info: missingByRules.filter(m => m.severity === 'info').map(m => m.field)
  };
  
  const presentCount = presentFields.length;
  const totalCount = requiredFields.length;
  const scorePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;
  
  return {
    scorePct,
    presentCount,
    totalCount,
    missing,
    missingFieldDetails: missingByRules
  };
}

/**
 * Get human-readable field name
 */
export function getFieldDisplayName(field: string): string {
  const mapping: Record<string, string> = {
    'dea_number': 'DEA Number',
    'dea_expiry': 'DEA Expiration Date',
    'state_license_number': 'State License Number',
    'state_license_expiry': 'State License Expiration',
    'state': 'State/Jurisdiction',
    'tddd_certificate': 'TDDD Certificate Number',
    'tddd_expiry': 'TDDD Certificate Expiration',
    'authorized_schedules': 'Authorized Controlled Substance Schedules',
    'requested_schedule': 'Requested Substance Schedule',
    'attestation_complete': 'CSF Attestation Completion',
    'attestation_date': 'Attestation Date',
    'npi': 'NPI (National Provider Identifier)',
    'practitioner_name': 'Practitioner Name',
    'is_telemedicine': 'Telemedicine Flag',
    'telemedicine_certification': 'Telemedicine DEA Certification',
    'requested_quantity': 'Requested Quantity',
    'facility_dea_number': 'Facility DEA Number',
    'facility_dea_expiry': 'Facility DEA Expiration',
    'facility_state': 'Facility State',
    'facility_tddd_certificate': 'Facility TDDD Certificate',
    'facility_tddd_expiry': 'Facility TDDD Expiration',
    'tddd_category': 'TDDD Category',
    'requested_substance': 'Requested Substance'
  };
  
  return mapping[field] || field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
