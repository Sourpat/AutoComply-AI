/**
 * Playbook Engine
 * 
 * Rule-driven logic to evaluate playbook steps based on case state,
 * fired rules, missing evidence, and available evidence.
 * 
 * Step 2.6: Reviewer Playbooks
 */

import type { 
  Playbook, 
  PlaybookEvaluation, 
  PlaybookStepWithState,
  PlaybookStepState,
  PlaybookAction 
} from '../types/playbook';

interface FiredRule {
  id: string;
  severity: string;
  title?: string;
  evidence?: any[];
}

interface PlaybookEngineInput {
  playbook: Playbook;
  caseStatus: string;
  firedRules: FiredRule[];
  missingEvidence: string[];
  availableEvidence?: string[];
}

/**
 * Evaluate playbook steps based on case state
 */
export function evaluatePlaybook(input: PlaybookEngineInput): PlaybookEvaluation {
  const { playbook, caseStatus, firedRules, missingEvidence, availableEvidence = [] } = input;
  
  const steps: PlaybookStepWithState[] = playbook.steps.map(step => {
    const state = evaluateStep(step, firedRules, missingEvidence, availableEvidence);
    const linkedRules = findLinkedRules(step, firedRules);
    const linkedEvidence = findLinkedEvidence(step, availableEvidence);
    
    return {
      ...step,
      state,
      linkedRules,
      linkedEvidence,
    };
  });
  
  // Filter suggested actions based on case status and step states
  const suggestedActions = filterSuggestedActions(
    playbook.suggestedActions,
    caseStatus,
    steps
  );
  
  // Calculate summary
  const summary = {
    totalSteps: steps.length,
    blockedSteps: steps.filter(s => s.state === 'blocked').length,
    attentionSteps: steps.filter(s => s.state === 'attention').length,
    satisfiedSteps: steps.filter(s => s.state === 'satisfied').length,
    pendingSteps: steps.filter(s => s.state === 'pending').length,
  };
  
  return {
    playbook,
    steps,
    suggestedActions,
    summary,
  };
}

/**
 * Evaluate a single step to determine its state
 */
function evaluateStep(
  step: any,
  firedRules: FiredRule[],
  missingEvidence: string[],
  availableEvidence: string[]
): PlaybookStepState {
  // Check if any fired rules match this step
  if (step.ruleIds && step.ruleIds.length > 0) {
    const matchingRules = firedRules.filter(rule => 
      step.ruleIds.includes(rule.id)
    );
    
    if (matchingRules.length > 0) {
      // Determine state based on severity of matching rules
      const hasBlocker = matchingRules.some(r => r.severity === 'block');
      const hasReview = matchingRules.some(r => r.severity === 'review');
      
      if (hasBlocker) return 'blocked';
      if (hasReview) return 'attention';
    }
  }
  
  // Check if required evidence is missing based on tags
  if (step.required && step.evidenceTags && step.evidenceTags.length > 0) {
    const hasMissingEvidence = missingEvidence.some(missing => 
      step.evidenceTags.some((tag: string) => 
        missing.toLowerCase().includes(tag.toLowerCase())
      )
    );
    
    if (hasMissingEvidence) {
      return step.severity === 'block' ? 'blocked' : 'attention';
    }
  }
  
  // Check if evidence is available for this step
  if (step.evidenceTags && step.evidenceTags.length > 0) {
    const hasEvidence = availableEvidence.some(evidence =>
      step.evidenceTags.some((tag: string) =>
        evidence.toLowerCase().includes(tag.toLowerCase())
      )
    );
    
    if (hasEvidence && !step.required) {
      return 'satisfied';
    }
  }
  
  // For required steps with no issues, mark as satisfied
  if (step.required) {
    return 'satisfied';
  }
  
  // Default state
  return 'pending';
}

/**
 * Find rules that are linked to this step
 */
function findLinkedRules(step: any, firedRules: FiredRule[]): string[] {
  if (!step.ruleIds || step.ruleIds.length === 0) {
    return [];
  }
  
  return firedRules
    .filter(rule => step.ruleIds.includes(rule.id))
    .map(rule => rule.id);
}

/**
 * Find evidence that is relevant to this step
 */
function findLinkedEvidence(step: any, availableEvidence: string[]): string[] {
  if (!step.evidenceTags || step.evidenceTags.length === 0) {
    return [];
  }
  
  return availableEvidence.filter(evidence =>
    step.evidenceTags.some((tag: string) =>
      evidence.toLowerCase().includes(tag.toLowerCase())
    )
  );
}

/**
 * Filter suggested actions based on case status and step states
 */
function filterSuggestedActions(
  actions: PlaybookAction[],
  caseStatus: string,
  steps: PlaybookStepWithState[]
): PlaybookAction[] {
  const hasBlockers = steps.some(s => s.state === 'blocked');
  
  return actions.filter(action => {
    // Check status filter
    if (action.when?.statuses) {
      if (!action.when.statuses.includes(caseStatus)) {
        return false;
      }
    }
    
    // Check blocker requirement
    if (action.when?.requiresNoBlockers) {
      if (hasBlockers) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Get playbook by decision type
 */
export function getPlaybookByDecisionType(decisionType: string): Playbook | null {
  // Import from registry - note: synchronous require not supported in ES modules
  // For now, return null and handle playbooks elsewhere
  // TODO: Refactor to use static imports or async function
  console.warn('getPlaybookByDecisionType: Dynamic imports not supported in sync context');
  return null;
}

/**
 * Generate request info template with missing evidence details
 */
export function generateRequestInfoFromPlaybook(
  evaluation: PlaybookEvaluation,
  missingEvidence: string[]
): string {
  const blockedSteps = evaluation.steps.filter(s => s.state === 'blocked');
  const attentionSteps = evaluation.steps.filter(s => s.state === 'attention');
  
  let message = 'We need additional information to complete your application:\n\n';
  
  if (blockedSteps.length > 0) {
    message += '**Critical Requirements:**\n';
    blockedSteps.forEach(step => {
      message += `• ${step.label}\n`;
      if (step.detail) {
        message += `  ${step.detail}\n`;
      }
    });
    message += '\n';
  }
  
  if (attentionSteps.length > 0) {
    message += '**Additional Information Needed:**\n';
    attentionSteps.forEach(step => {
      message += `• ${step.label}\n`;
      if (step.detail) {
        message += `  ${step.detail}\n`;
      }
    });
    message += '\n';
  }
  
  if (missingEvidence.length > 0) {
    message += '**Missing Documents:**\n';
    missingEvidence.forEach(item => {
      message += `• ${item}\n`;
    });
    message += '\n';
  }
  
  message += 'Please provide the requested information within 5 business days.\n';
  
  return message;
}
