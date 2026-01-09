/**
 * Counterfactual Generator
 * 
 * Generates "why rule did not fire" explanations for non-triggered rules
 */

import { getRuleExpectations, type RuleExpectation } from './ruleExpectations';

export interface Counterfactual {
  ruleId: string;
  title: string;
  severity: 'block' | 'review' | 'info';
  whyNot: string;
  toSatisfy: string;
  jurisdiction?: string;
  citation?: string;
  missingFields: string[];
}

/**
 * Check if a field value is present and non-empty
 */
function isFieldPresent(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return true;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Generate counterfactual explanation for a rule that did not fire
 */
function generateCounterfactual(
  rule: RuleExpectation,
  payload: Record<string, any>
): Counterfactual {
  // Check which required evidence fields are missing
  const missingFields = rule.requiredEvidence.filter(
    field => !isFieldPresent(payload[field])
  );
  
  let whyNot: string;
  let toSatisfy: string;
  
  if (missingFields.length > 0) {
    // Rule didn't fire because evidence is missing
    const fieldNames = missingFields.map(f => 
      f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    );
    
    whyNot = `Not triggered because required data is missing: ${fieldNames.join(', ')}`;
    toSatisfy = `Provide complete ${fieldNames.join(', ')} to enable this rule evaluation`;
  } else {
    // Rule didn't fire because condition is false (data present but condition not met)
    // Use the trigger condition summary
    whyNot = `Not triggered - condition not met: ${rule.triggerConditionSummary.toLowerCase()}`;
    
    // Infer what would satisfy based on rule type
    if (rule.ruleId.includes('telemedicine')) {
      toSatisfy = 'This rule only applies to telemedicine prescriptions';
    } else if (rule.ruleId.includes('ohio')) {
      toSatisfy = 'This rule only applies to Ohio jurisdictions';
    } else if (rule.ruleId.includes('schedule')) {
      toSatisfy = 'Ensure practitioner authorization matches requested substance schedule';
    } else if (rule.ruleId.includes('expiry') || rule.ruleId.includes('expired')) {
      toSatisfy = 'Credentials are currently valid (not expired)';
    } else {
      toSatisfy = 'Current submission data satisfies this requirement';
    }
  }
  
  return {
    ruleId: rule.ruleId,
    title: rule.title,
    severity: rule.severity,
    whyNot,
    toSatisfy,
    jurisdiction: rule.jurisdiction,
    citation: rule.citation,
    missingFields
  };
}

/**
 * Generate counterfactuals for rules that did not fire
 * 
 * @param csfType - Type of CSF (practitioner, hospital, etc.)
 * @param payload - Submission payload
 * @param firedRuleIds - Array of rule IDs that actually fired
 * @param maxCount - Maximum number of counterfactuals to return (default 5)
 */
export function generateCounterfactuals(
  csfType: string,
  payload: Record<string, any>,
  firedRuleIds: string[],
  maxCount: number = 5
): Counterfactual[] {
  const allRules = getRuleExpectations(csfType);
  
  // Filter out rules that already fired
  const notFiredRules = allRules.filter(
    rule => !firedRuleIds.includes(rule.ruleId)
  );
  
  // Generate counterfactuals
  const counterfactuals = notFiredRules.map(rule => 
    generateCounterfactual(rule, payload)
  );
  
  // Sort by priority:
  // 1. Rules with missing fields (most actionable)
  // 2. BLOCK severity
  // 3. REVIEW severity
  // 4. INFO severity
  const sorted = counterfactuals.sort((a, b) => {
    // Prioritize rules with missing fields
    if (a.missingFields.length > 0 && b.missingFields.length === 0) return -1;
    if (a.missingFields.length === 0 && b.missingFields.length > 0) return 1;
    
    // Then by severity
    const severityOrder = { block: 0, review: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  
  // Return top N
  return sorted.slice(0, maxCount);
}

/**
 * Get a summary count of counterfactuals by severity
 */
export function getCounterfactualSummary(counterfactuals: Counterfactual[]): {
  total: number;
  block: number;
  review: number;
  info: number;
  withMissingData: number;
} {
  return {
    total: counterfactuals.length,
    block: counterfactuals.filter(c => c.severity === 'block').length,
    review: counterfactuals.filter(c => c.severity === 'review').length,
    info: counterfactuals.filter(c => c.severity === 'info').length,
    withMissingData: counterfactuals.filter(c => c.missingFields.length > 0).length
  };
}
