/**
 * Coverage Dashboard Page
 * 
 * ============================================================================
 * Step 2.7: Coverage & Gaps Dashboard
 * ============================================================================
 * 
 * PURPOSE:
 * This dashboard provides visibility into the implementation completeness
 * of each decision type across the AutoComply AI platform. It shows:
 * - Overall coverage percentage per decision type
 * - Breakdown by component: Rules, Evidence, Playbook, Evaluator
 * - Identified gaps with severity levels (high/medium/low)
 * - Quick navigation to RAG Explorer with decision type filtering
 * 
 * DEMO-SAFE IMPLEMENTATION:
 * Currently uses deterministic signals from coverageService.getCoverageSignals()
 * which returns hardcoded values for each decision type. No backend dependency.
 * 
 * PRODUCTION MIGRATION PATH:
 * To replace placeholder signals with real implementation data:
 * 
 * 1. RULES COUNT:
 *    File: frontend/src/coverage/coverageService.ts
 *    Function: getCoverageSignals()
 *    Current: Hardcoded `rulesCount: 12` for csf_practitioner
 *    Replace with: Import actual rules from decision evaluator modules
 *    Example: import { CSF_PRACTITIONER_RULES } from '../evaluators/csfPractitioner';
 *             rulesCount: CSF_PRACTITIONER_RULES.length
 * 
 * 2. EVIDENCE SOURCES COUNT:
 *    Current: Hardcoded `evidenceSourcesCount: 8`
 *    Replace with: Query RAG knowledge base for available sources
 *    Example: const sources = await ragService.getEvidenceSources(decisionType);
 *             evidenceSourcesCount: sources.length
 * 
 * 3. EVIDENCE TAGS:
 *    Current: Hardcoded array `['ohio', 'tddd', 'controlled-substances', ...]`
 *    Replace with: Import from evidence taxonomy or RAG configuration
 *    Example: import { EVIDENCE_TAGS_CSF_PRACTITIONER } from '../evidence/tags';
 *             evidenceTagsPresent: EVIDENCE_TAGS_CSF_PRACTITIONER
 * 
 * 4. PLAYBOOK STEP COUNT:
 *    Current: Hardcoded `playbookStepCount: 12`
 *    Replace with: Import actual playbook definition
 *    Example: import { csfPractitionerPlaybook } from '../playbooks/csfPractitionerPlaybook';
 *             playbookStepCount: csfPractitionerPlaybook.steps.length
 * 
 * NAVIGATION:
 * - Back to Console: /console
 * - RAG Explorer: /rag (general mode)
 * - RAG Explorer (filtered): /rag?mode=connected&decisionType={decisionType}
 * - Create Coverage Item: Demo alert stub (replace with form modal)
 * 
 * COVERAGE CALCULATION:
 * Overall coverage is a weighted average:
 * - Rules: 25%
 * - Evidence Sources: 20%
 * - Evidence Tags: 15%
 * - Playbook: 20%
 * - Evaluator: 20%
 * 
 * GAP SEVERITY THRESHOLDS:
 * - HIGH: Missing evaluator implementation, <50% rules coverage
 * - MEDIUM: 50-80% coverage, missing playbook
 * - LOW: >80% coverage, missing optional features
 * 
 * ============================================================================
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildCoverageResults, getCoverageSummary } from '../coverage/coverageService';
import type { CoverageResult } from '../coverage/coverageService';

const getCoverageColor = (pct: number) => {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 70) return 'text-yellow-600';
  if (pct >= 50) return 'text-orange-600';
  return 'text-red-600';
};

const getCoverageBgColor = (pct: number) => {
  if (pct >= 90) return 'bg-green-100';
  if (pct >= 70) return 'bg-yellow-100';
  if (pct >= 50) return 'bg-orange-100';
  return 'bg-red-100';
};

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const CoverageCard: React.FC<{ result: CoverageResult }> = ({ result }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900">{result.label}</h3>
          <p className="text-sm text-slate-600 mt-1">{result.description}</p>
        </div>
        <div className={`ml-4 px-3 py-1 rounded-full ${getCoverageBgColor(result.coverage.overallPct)} ${getCoverageColor(result.coverage.overallPct)} font-bold text-lg shrink-0`}>
          {result.coverage.overallPct}%
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Rules</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${getCoverageColor(result.coverage.rulesPct)}`}>
              {result.coverage.rulesPct}%
            </div>
            <div className="text-xs text-slate-600">
              {result.signals.rulesCount}/{result.capabilities.evaluatorImplemented ? result.signals.rulesCount : '?'}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Evidence</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${getCoverageColor(result.coverage.evidencePct)}`}>
              {result.coverage.evidencePct}%
            </div>
            <div className="text-xs text-slate-600">
              {result.signals.evidenceSourcesCount} sources
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Playbook</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${getCoverageColor(result.coverage.playbookPct)}`}>
              {result.coverage.playbookPct}%
            </div>
            <div className="text-xs text-slate-600">
              {result.capabilities.playbookImplemented ? `${result.signals.playbookStepCount} steps` : 'N/A'}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="text-xs font-medium text-slate-500 mb-1">Evaluator</div>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${getCoverageColor(result.coverage.evaluatorPct)}`}>
              {result.coverage.evaluatorPct}%
            </div>
            <div className="text-xs text-slate-600">
              {result.capabilities.evaluatorImplemented ? '✓' : '✗'}
            </div>
          </div>
        </div>
      </div>

      {/* Gaps Section */}
      <div className="border-t border-slate-200 pt-4 mb-4">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">
          Gaps {result.gaps.length > 0 && `(${result.gaps.length})`}
        </div>
        
        {result.gaps.length === 0 ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            ✓ No gaps detected
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {result.gaps.slice(0, 3).map((gap) => (
              <div
                key={gap.id}
                className={`border rounded-lg px-3 py-2 text-xs ${getSeverityColor(gap.severity)}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold uppercase text-[10px]">{gap.severity}</span>
                  <span>•</span>
                  <span className="font-medium">{gap.category}</span>
                </div>
                <div className="text-xs opacity-90">{gap.description}</div>
              </div>
            ))}
            {result.gaps.length > 3 && (
              <div className="text-xs text-slate-500 text-center">
                +{result.gaps.length - 3} more gaps
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to={`/rag?mode=connected&decisionType=${result.decisionType}`}
          className="flex-1 px-3 py-2 text-xs font-medium text-center bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          Open in RAG Explorer
        </Link>
        <button
          onClick={() => alert(`Create coverage item for: ${result.label}\n\nThis would open a form to add:\n- New rules\n- Evidence sources\n- Playbook steps\n- Test scenarios`)}
          className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
};

export default function CoverageDashboardPage() {
  const coverageResults = useMemo(() => buildCoverageResults(), []);
  const summary = useMemo(() => getCoverageSummary(), []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Coverage Dashboard</h1>
              <p className="text-sm text-slate-600 mt-1">
                Implementation coverage and gaps across all decision types
              </p>
            </div>
            
            {/* Navigation Links */}
            <div className="flex gap-3">
              <Link
                to="/console"
                className="px-4 py-2 text-sm font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Open Console
              </Link>
              <Link
                to="/rag"
                className="px-4 py-2 text-sm font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
              >
                RAG Explorer
              </Link>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-4 mt-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500 mb-1">Decision Types</div>
              <div className="text-3xl font-bold text-slate-900">{summary.totalDecisionTypes}</div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-xs font-medium text-green-700 mb-1">Fully Implemented</div>
              <div className="text-3xl font-bold text-green-700">{summary.fullyImplemented}</div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-xs font-medium text-yellow-700 mb-1">Partial</div>
              <div className="text-3xl font-bold text-yellow-700">{summary.partiallyImplemented}</div>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-medium text-slate-500 mb-1">Not Implemented</div>
              <div className="text-3xl font-bold text-slate-900">{summary.notImplemented}</div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-xs font-medium text-blue-700 mb-1">Avg Coverage</div>
              <div className="text-3xl font-bold text-blue-700">{summary.averageCoverage}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* High Priority Alerts */}
        {summary.highSeverityGaps > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">
                {summary.highSeverityGaps} high-severity gap{summary.highSeverityGaps !== 1 ? 's' : ''} detected across decision types
              </span>
            </div>
            <p className="text-sm text-red-700 mt-1 ml-7">
              Critical components missing. Review cards below for details.
            </p>
          </div>
        )}

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {coverageResults.map((result) => (
            <CoverageCard key={result.decisionType} result={result} />
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <div className="font-semibold text-blue-900 text-sm">About Coverage Metrics</div>
              <p className="text-sm text-blue-800 mt-1">
                Coverage is calculated as a weighted average: Rules (25%), Evidence (20%), Tags (15%), Playbook (20%), Evaluator (20%).
                Gaps are identified by comparing actual implementation signals against target requirements.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
