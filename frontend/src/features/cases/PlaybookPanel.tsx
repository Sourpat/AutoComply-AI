/**
 * Playbook Panel Component
 * 
 * Displays reviewer playbook with step-by-step checklist and suggested actions.
 * Steps are highlighted based on fired rules, missing evidence, and case state.
 * 
 * Step 2.6: Reviewer Playbooks
 */

import React, { useMemo, useState } from 'react';
import type { PlaybookEvaluation, PlaybookStepWithState, PlaybookAction } from '../../types/playbook';
import type { WorkQueueItem } from '../../types/workQueue';
import { evaluatePlaybook, generateRequestInfoFromPlaybook } from '../../workflow/playbookEngine';
import { getPlaybookForDecisionType } from '../../playbooks/index';
import { useRole } from '../../context/RoleContext';

interface PlaybookPanelProps {
  caseItem: WorkQueueItem;
  onRequestInfo?: (template: string) => void;
  onStatusChange?: (newStatus: string, note?: string, meta?: any) => void;
  onAddNote?: (note: string) => void;
}

const getStateIcon = (state: string) => {
  switch (state) {
    case 'blocked':
      return '⛔';
    case 'attention':
      return '⚠️';
    case 'satisfied':
      return '✅';
    default:
      return '⭕';
  }
};

const getStateColor = (state: string) => {
  switch (state) {
    case 'blocked':
      return 'text-red-700 border-red-300 bg-red-50';
    case 'attention':
      return 'text-yellow-700 border-yellow-300 bg-yellow-50';
    case 'satisfied':
      return 'text-green-700 border-green-300 bg-green-50';
    default:
      return 'text-slate-700 border-slate-300 bg-slate-50';
  }
};

export const PlaybookPanel: React.FC<PlaybookPanelProps> = ({
  caseItem,
  onRequestInfo,
  onStatusChange,
  onAddNote,
}) => {
  const { role, isSubmitter } = useRole();
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Evaluate playbook based on case state
  const evaluation: PlaybookEvaluation | null = useMemo(() => {
    // Determine decision type from case
    const decisionType = caseItem.decisionType || 'csf_practitioner';
    
    // Get playbook by decision type from registry
    const playbook = getPlaybookForDecisionType(decisionType);
    
    if (!playbook) {
      return null;
    }
    
    // Extract fired rules from case
    const firedRules = ((caseItem as any).firedRules || []).map((rule: any) => ({
      id: rule.id || rule.ruleId || '',
      severity: rule.severity || 'info',
      title: rule.title,
      evidence: rule.evidence,
    }));
    
    // Extract missing evidence
    const missingEvidence = (caseItem as any).missingEvidence || [];
    
    // Extract available evidence (from evidence array)
    const availableEvidence = ((caseItem as any).evidence || []).map((ev: any) => 
      `${ev.docTitle || ''} ${ev.snippet || ''} ${ev.jurisdiction || ''}`
    );
    
    return evaluatePlaybook({
      playbook,
      caseStatus: caseItem.status,
      firedRules,
      missingEvidence,
      availableEvidence,
    });
  }, [caseItem]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const handleActionClick = (action: PlaybookAction) => {
    if (isSubmitter) {
      // Submitters cannot execute actions
      return;
    }

    // Prepare audit metadata
    const auditMeta = {
      source: 'playbook',
      playbookId: evaluation?.playbook.id,
      actionId: action.id,
      actionKind: action.kind,
    };

    switch (action.kind) {
      case 'APPROVE':
        onStatusChange?.('approved', undefined, auditMeta);
        break;
      case 'BLOCK':
        onStatusChange?.('blocked', action.template, auditMeta);
        break;
      case 'NEEDS_REVIEW':
        onStatusChange?.('needs_review', action.template, auditMeta);
        break;
      case 'REQUEST_INFO':
        if (evaluation) {
          const template = action.template || generateRequestInfoFromPlaybook(
            evaluation,
            (caseItem as any).missingEvidence || []
          );
          onRequestInfo?.(template);
        }
        break;
      case 'ADD_NOTE':
        onAddNote?.(action.template || 'Reviewer note: ');
        break;
    }
  };

  if (!evaluation) {
    return (
      <div className="p-4 border border-yellow-500/40 bg-yellow-950/20 rounded-lg">
        <p className="text-sm text-yellow-300 font-medium">
          ⚠️ No playbook available for this decision type yet
        </p>
        <p className="text-xs text-yellow-400/80 mt-2">
          Decision type: {caseItem.decisionType || 'unknown'}
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Use generic review checklist or contact your supervisor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-white">
          {evaluation.playbook.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {evaluation.playbook.description}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{evaluation.summary.satisfiedSteps}</div>
          <div className="text-[10px] text-green-400">Satisfied</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{evaluation.summary.attentionSteps}</div>
          <div className="text-[10px] text-yellow-400">Attention</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{evaluation.summary.blockedSteps}</div>
          <div className="text-[10px] text-red-400">Blocked</div>
        </div>
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-white">{evaluation.summary.pendingSteps}</div>
          <div className="text-[10px] text-gray-400">Pending</div>
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          Review Checklist ({evaluation.summary.totalSteps} steps)
        </div>
        
        {evaluation.steps.map((step: PlaybookStepWithState) => {
          const isExpanded = expandedSteps.has(step.id);
          const stateColor = getStateColor(step.state);
          
          return (
            <div
              key={step.id}
              className={`border rounded-lg overflow-hidden ${stateColor}`}
            >
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 text-left">
                  <span className="text-lg">{getStateIcon(step.state)}</span>
                  <span className="text-sm font-medium text-slate-900">
                    {step.label}
                  </span>
                  {step.required && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-red-100 border border-red-300 text-red-700 rounded font-semibold">
                      REQUIRED
                    </span>
                  )}
                </div>
                <svg
                  className={`h-4 w-4 transition-transform text-slate-600 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isExpanded && (
                <div className="px-3 py-3 border-t border-slate-200 bg-white space-y-2">
                  {step.detail && (
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {step.detail}
                    </p>
                  )}
                  
                  {step.linkedRules && step.linkedRules.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Linked Rules:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {step.linkedRules.map((ruleId, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-700 rounded text-[10px] font-mono"
                          >
                            {ruleId}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {step.evidenceTags && step.evidenceTags.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        Evidence Tags:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {step.evidenceTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 rounded text-[10px]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Suggested Actions */}
      {evaluation.suggestedActions.length > 0 && !isSubmitter && (
        <div className="border-t border-gray-700 pt-4">
          <div className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
            Suggested Actions
          </div>
          <div className="grid grid-cols-2 gap-2">
            {evaluation.suggestedActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  action.kind === 'APPROVE'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : action.kind === 'BLOCK'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : action.kind === 'NEEDS_REVIEW'
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {isSubmitter && (
        <div className="border border-blue-500/40 bg-blue-950/20 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            ℹ️ This playbook is for reviewer reference. As a submitter, you can view the steps but cannot execute actions.
          </p>
        </div>
      )}
    </div>
  );
};
