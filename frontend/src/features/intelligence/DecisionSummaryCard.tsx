import React, { useState } from "react";
import type { Gap, BiasFlag, FailedRule } from "../../api/intelligenceApi";
import { FreshnessIndicator } from "./FreshnessIndicator";

interface DecisionSummaryCardProps {
  narrative?: string;
  gaps: Gap[];
  biasFlags: BiasFlag[];
  confidenceBand: 'high' | 'medium' | 'low';
  rulesTotal?: number;
  rulesPassed?: number;
  failedRules?: FailedRule[];
  computedAt?: string;
  isStale?: boolean;
  // Phase 7.15: Field validation
  fieldChecksTotal?: number;
  fieldChecksPassed?: number;
  confidenceRationale?: string;
}

// Severity ordering for sorting
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

/**
 * Filter and normalize gaps to remove empty content
 */
function normalizeGaps(gaps: Gap[]): Gap[] {
  return gaps.filter(gap => {
    const hasContent = (gap.description && gap.description.trim()) ||
                       (gap.affected_area && gap.affected_area.trim()) ||
                       (gap.expected_signal && gap.expected_signal.trim());
    return hasContent;
  });
}

/**
 * Get display title for a gap
 */
function getGapTitle(gap: Gap): string {
  return gap.description?.trim() || 
         `${gap.affected_area || gap.gap_type || 'gap'} (${gap.gap_type || 'unknown'})`;
}

/**
 * DecisionSummaryCard Component
 * 
 * Executive-friendly summary of decision intelligence with:
 * - What we know (positive indicators)
 * - What we don't know (gaps)
 * - Risk/Bias warnings
 * - Suggested next action
 */
export const DecisionSummaryCard: React.FC<DecisionSummaryCardProps> = ({
  narrative,
  gaps,
  biasFlags,
  confidenceBand,
  rulesTotal = 0,
  rulesPassed = 0,
  failedRules = [],
  computedAt,
  isStale = false,
  fieldChecksTotal = 0,
  fieldChecksPassed = 0,
  confidenceRationale,
}) => {
  // Check for critical rule failures
  const hasCriticalFailure = failedRules.some(r => r.severity === 'critical');

  // State for showing all gaps and failed rules
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [showAllFailedRules, setShowAllFailedRules] = useState(false);

  // Normalize gaps to remove empty content
  const validGaps = React.useMemo(() => normalizeGaps(gaps), [gaps]);

  // Generate "What we know" from confidence band and lack of critical issues
  const whatWeKnow = React.useMemo(() => {
    const positives: string[] = [];

    if (confidenceBand === 'high') {
      positives.push('Strong evidence base with complete documentation');
    } else if (confidenceBand === 'medium') {
      positives.push('Adequate evidence available for decision');
    }

    const criticalGaps = validGaps.filter(g => g.severity === 'high').length;
    const criticalBias = biasFlags.filter(b => b.severity === 'high').length;

    if (criticalGaps === 0) {
      positives.push('No critical information gaps detected');
    }

    if (criticalBias === 0) {
      positives.push('No significant bias patterns in evidence');
    }

    // Add rules summary if available
    if (rulesTotal > 0 && rulesPassed === rulesTotal) {
      positives.push(`All ${rulesTotal} compliance rules passed`);
    }

    if (positives.length === 0) {
      positives.push('Decision analysis in progress');
    }

    return positives.filter(p => p && p.trim()); // Extra safety filter
  }, [confidenceBand, validGaps, biasFlags, rulesTotal, rulesPassed]);

  // Generate "What we don't know" from gaps - sorted by severity
  const whatWeDontKnow = React.useMemo(() => {
    if (validGaps.length === 0) {
      return [];
    }

    // Sort by severity (critical > high > medium > low)
    const sortedGaps = [...validGaps].sort((a, b) => {
      const severityA = SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 999;
      const severityB = SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 999;
      return severityA - severityB;
    });

    // Filter to high/medium priority and get titles
    const topGaps = sortedGaps
      .filter(g => g.severity === 'high' || g.severity === 'medium')
      .map(g => getGapTitle(g))
      .filter(title => title && title.trim()); // Remove empty titles

    return topGaps;
  }, [validGaps]);

  // Top 5 gaps to display
  const displayedGaps = showAllGaps ? whatWeDontKnow : whatWeDontKnow.slice(0, 5);
  const hasMoreGaps = whatWeDontKnow.length > 5;

  // Generate risk/bias warnings
  const warnings = React.useMemo(() => {
    return biasFlags
      .filter(b => b.severity === 'high' || b.severity === 'medium')
      .slice(0, 3)
      .map(b => b.description)
      .filter(desc => desc && desc.trim()); // Remove empty descriptions
  }, [biasFlags]);

  // Top 5 failed rules to display
  const topFailedRules = React.useMemo(() => {
    // Sort by severity (critical > high > medium > low)
    const sorted = [...failedRules].sort((a, b) => {
      const severityA = SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 999;
      const severityB = SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 999;
      return severityA - severityB;
    });
    return sorted.slice(0, 5);
  }, [failedRules]);

  // Suggested next action heuristic
  const suggestedAction = React.useMemo(() => {
    const criticalGaps = validGaps.filter(g => g.severity === 'high').length;
    const criticalBias = biasFlags.filter(b => b.severity === 'high').length;

    if (hasCriticalFailure) {
      return 'Address critical rule failures before proceeding with decision';
    }

    if (criticalGaps > 0) {
      return 'Request missing information from submitter to fill critical gaps';
    }

    if (criticalBias > 0) {
      return 'Verify evidence with additional independent sources';
    }

    if (confidenceBand === 'high') {
      return 'Sufficient confidence to proceed with decision';
    }

    if (validGaps.length > 0) {
      return 'Consider requesting additional documentation to increase confidence';
    }

    return 'Review case details and proceed with decision workflow';
  }, [validGaps, biasFlags, confidenceBand, hasCriticalFailure]);

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-50">Decision Summary</h3>
            <div className="mt-1 flex items-center gap-3">
              <p className="text-xs text-zinc-400">
                Executive overview of decision intelligence
              </p>
              {/* Phase 7.10: Freshness indicator */}
              {computedAt && (
                <FreshnessIndicator
                  computedAt={computedAt}
                  isStale={isStale}
                />
              )}
            </div>
          </div>
          
          {/* Phase 7.13/7.15: Compact badges for Rules and Fields */}
          <div className="flex items-center gap-2">
            {rulesTotal > 0 && (
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                hasCriticalFailure 
                  ? 'bg-red-950/50 border-red-800/50' 
                  : rulesPassed === rulesTotal 
                  ? 'bg-emerald-950/50 border-emerald-800/50'
                  : 'bg-amber-950/50 border-amber-800/50'
              }`}>
                {hasCriticalFailure && <span className="text-red-400 text-xs">⚠</span>}
                <span className={`text-xs font-medium ${
                  hasCriticalFailure 
                    ? 'text-red-300' 
                    : rulesPassed === rulesTotal 
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                }`}>
                  Rules {rulesPassed}/{rulesTotal}
                </span>
              </div>
            )}
            {fieldChecksTotal > 0 && (
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                fieldChecksPassed === fieldChecksTotal
                  ? 'bg-emerald-950/50 border-emerald-800/50'
                  : 'bg-amber-950/50 border-amber-800/50'
              }`}>
                <span className={`text-xs font-medium ${
                  fieldChecksPassed === fieldChecksTotal
                    ? 'text-emerald-300'
                    : 'text-amber-300'
                }`}>
                  Fields {fieldChecksPassed}/{fieldChecksTotal}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Narrative (if provided by backend) */}
      {narrative && (
        <div className="rounded border border-zinc-700/50 bg-zinc-900/50 p-3">
          <div className="text-xs font-medium text-zinc-300">{narrative}</div>
        </div>
      )}

      {/* Phase 7.15: Confidence Rationale */}
      {confidenceRationale && (
        <div className="rounded border border-zinc-700/50 bg-zinc-900/50 p-3">
          <div className="mb-1 text-xs font-medium text-zinc-400">Confidence Rationale</div>
          <div className="text-xs text-zinc-300">{confidenceRationale}</div>
        </div>
      )}

      {/* What we know */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          What We Know
        </h4>
        <ul className="space-y-1.5">
          {whatWeKnow.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
              <span className="mt-1 text-emerald-500">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* What we don't know */}
      {whatWeDontKnow.length > 0 ? (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            What We Don't Know
          </h4>
          <ul className="space-y-1.5">
            {displayedGaps.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                <span className="mt-1 text-amber-500">!</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {/* Show all toggle */}
          {hasMoreGaps && (
            <button
              onClick={() => setShowAllGaps(!showAllGaps)}
              className="mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              {showAllGaps ? 'Show less' : `Show all (${whatWeDontKnow.length})`}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded border border-emerald-700/50 bg-emerald-950/30 p-3">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            <span className="text-xs text-emerald-300">No additional unknowns detected</span>
          </div>
        </div>
      )}

      {/* Failed Rules Summary - Phase 7.13: Collapsible */}
      {failedRules.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              Failed Rules ({failedRules.length})
            </h4>
            {failedRules.length > 3 && (
              <button
                onClick={() => setShowAllFailedRules(!showAllFailedRules)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                {showAllFailedRules ? 'Show less' : `Show all (${failedRules.length})`}
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {(showAllFailedRules ? failedRules : topFailedRules).map((rule, idx) => (
              <li key={idx} className="rounded border border-red-800/50 bg-red-950/20 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        rule.severity === 'critical' 
                          ? 'bg-red-900/50 text-red-200 border border-red-700'
                          : rule.severity === 'high'
                          ? 'bg-orange-900/50 text-orange-200 border border-orange-700'
                          : 'bg-yellow-900/50 text-yellow-200 border border-yellow-700'
                      }`}>
                        {rule.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">{rule.rule_id}</span>
                    </div>
                    <div className="mt-1.5 text-xs text-zinc-300">{rule.message}</div>
                    {rule.expected_value && (
                      <div className="mt-1.5 text-[10px] text-zinc-500">
                        Expected: <span className="font-mono text-zinc-400">{rule.expected_value}</span>
                        {rule.actual_value && (
                          <> | Actual: <span className="font-mono text-zinc-400">{rule.actual_value}</span></>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk/Bias warnings */}
      {warnings.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            Risk & Bias Warnings
          </h4>
          <ul className="space-y-1.5">
            {warnings.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                <span className="mt-1 text-red-500">⚠</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested next action */}
      <div className="rounded border border-blue-800/50 bg-blue-950/30 p-3">
        <h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-blue-300">
          <span>→</span>
          Suggested Next Action
        </h4>
        <p className="text-xs text-blue-200/90">{suggestedAction}</p>
      </div>
    </div>
  );
};
