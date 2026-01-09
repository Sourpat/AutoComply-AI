/**
 * Playbook Registry
 * 
 * Central registry for all reviewer playbooks. Maps decision types to their
 * corresponding playbook definitions.
 * 
 * Step 2.15: Deterministic Evaluators - Reviewer Playbooks
 */

import type { Playbook } from '../types/playbook';
import { csfPractitionerPlaybook } from './csfPractitionerPlaybook';
import { ohioTdddPlaybook } from './ohioTdddPlaybook';
import { nyPharmacyLicensePlaybook } from './nyPharmacyLicensePlaybook';
import { csfFacilityPlaybook } from './csfFacilityPlaybook';

/**
 * Playbook registry mapping decision types to playbook definitions
 */
export const playbookRegistry: Record<string, Playbook> = {
  csf_practitioner: csfPractitionerPlaybook,
  ohio_tddd: ohioTdddPlaybook,
  ny_pharmacy_license: nyPharmacyLicensePlaybook,
  csf_facility: csfFacilityPlaybook,
};

/**
 * Get playbook by decision type
 */
export function getPlaybookForDecisionType(decisionType: string): Playbook | null {
  return playbookRegistry[decisionType] || null;
}

/**
 * Get all registered playbooks
 */
export function getAllPlaybooks(): Playbook[] {
  return Object.values(playbookRegistry);
}

/**
 * Check if playbook exists for decision type
 */
export function hasPlaybook(decisionType: string): boolean {
  return decisionType in playbookRegistry;
}

/**
 * Get playbook step count by decision type
 */
export function getPlaybookStepCount(decisionType: string): number {
  const playbook = playbookRegistry[decisionType];
  return playbook ? playbook.steps.length : 0;
}
