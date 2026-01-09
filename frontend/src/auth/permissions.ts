/**
 * Role-based Permissions Helper
 * 
 * Centralized permission checks for role-based access control
 */

import type { UserRole } from '../context/RoleContext';

/**
 * Can view raw evidence snippets and citations
 */
export function canViewEvidence(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can view rule IDs and technical details
 */
export function canViewRuleIds(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can use Connected Mode (trace replay from submissions)
 */
export function canUseConnectedMode(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can clear demo data
 */
export function canClearDemoData(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Can seed demo data
 */
export function canSeedDemoData(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Can view verification work queue
 */
export function canViewWorkQueue(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can view trace metadata and debug panels
 */
export function canViewDebugPanels(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Can download decision packets
 */
export function canDownloadPackets(role: UserRole): boolean {
  // Admin can always download, verifier can download from results
  return role === 'admin' || role === 'verifier';
}

/**
 * Can view recent decisions table
 */
export function canViewRecentDecisions(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can view fired rules section
 */
export function canViewFiredRules(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can view counterfactuals (why rules didn't fire)
 */
export function canViewCounterfactuals(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Can export to HTML
 */
export function canExportHtml(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Can view completeness score details
 */
export function canViewCompletenessDetails(role: UserRole): boolean {
  return role === 'verifier' || role === 'admin';
}

/**
 * Get role-specific instructions for RAG Explorer
 */
export function getRagExplorerInstructions(role: UserRole): string {
  const instructions: Record<UserRole, string> = {
    submitter: 'Use this to see what\'s missing and what to provide next.',
    verifier: 'Use this to validate submissions using rules + evidence.',
    admin: 'Use this to debug traces and validate policy coverage.'
  };
  return instructions[role];
}

/**
 * Get role-specific instructions for Compliance Console
 */
export function getConsoleInstructions(role: UserRole): string {
  const instructions: Record<UserRole, string> = {
    submitter: 'View your submissions and track their status.',
    verifier: 'Review and verify pending submissions in the work queue.',
    admin: 'Manage the compliance system and monitor all activities.'
  };
  return instructions[role];
}
