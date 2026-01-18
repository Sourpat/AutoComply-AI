import React, { useState, useEffect } from "react";
import { getCaseIntelligence, recomputeCaseIntelligence } from "../../api/intelligenceApi";
import type { DecisionIntelligenceResponse } from "../../api/intelligenceApi";
import { getCachedIntelligence, setCachedIntelligence, invalidateCachedIntelligence } from "../../utils/intelligenceCache";
import { useRole } from "../../context/RoleContext";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { DecisionSummaryCard } from "./DecisionSummaryCard";
import { BiasWarningsPanel } from "./BiasWarningsPanel";
import { GapsPanel } from "./GapsPanel";
import { FreshnessIndicator } from "./FreshnessIndicator";
import { RulesPanel } from "./RulesPanel";
import { FieldIssuesPanel } from "./FieldIssuesPanel";
import { ConfidenceHistoryPanel } from "./ConfidenceHistoryPanel";

interface IntelligencePanelProps {
  caseId: string;
  decisionType: string;
  onRecomputeSuccess?: () => void;
}

/**
 * IntelligencePanel Component
 * 
 * Container for Decision Intelligence visualization.
 * Fetches intelligence data, displays all sub-components,
 * and provides recompute functionality.
 */
export const IntelligencePanel: React.FC<IntelligencePanelProps> = ({
  caseId,
  decisionType,
  onRecomputeSuccess,
}) => {
  const { isVerifier, isAdmin } = useRole();
  const [intelligence, setIntelligence] = useState<DecisionIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch intelligence data
  const fetchIntelligence = async (skipCache = false) => {
    setLoading(true);
    setError(null);

    try {
      // Check cache first (unless skipping)
      if (!skipCache) {
        const cached = getCachedIntelligence(caseId, decisionType);
        if (cached) {
          setIntelligence(cached);
          setLoading(false);
          return;
        }
      }

      // Fetch from API
      const data = await getCaseIntelligence(caseId, decisionType);
      setIntelligence(data);

      // Cache the result
      setCachedIntelligence(caseId, decisionType, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load intelligence';
      setError(message);
      console.error('[IntelligencePanel] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recompute intelligence
  const handleRecompute = async () => {
    setRecomputing(true);
    setError(null);

    try {
      // Phase 7.7: Call recompute endpoint (now includes admin_unlocked=1)
      await recomputeCaseIntelligence(caseId, decisionType);

      // Invalidate cache to force fresh fetch
      invalidateCachedIntelligence(caseId, decisionType);

      // Immediately refetch intelligence to get latest data
      const freshData = await getCaseIntelligence(caseId, decisionType);

      // Update state with fresh data
      setIntelligence(freshData);

      // Cache the new result
      setCachedIntelligence(caseId, decisionType, freshData);

      // Show success message
      console.log('[IntelligencePanel] Recompute successful, confidence:', freshData.confidence_score);

      // Trigger callback if provided
      onRecomputeSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recompute intelligence';
      setError(message);
      console.error('[IntelligencePanel] Recompute error:', err);
    } finally {
      setRecomputing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchIntelligence();
  }, [caseId, decisionType]);

  // Loading skeleton
  if (loading && !intelligence) {
    return (
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
          <div className="h-6 w-32 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="space-y-2">
          <div className="h-24 animate-pulse rounded-lg bg-zinc-800/50" />
          <div className="h-32 animate-pulse rounded-lg bg-zinc-800/50" />
          <div className="h-32 animate-pulse rounded-lg bg-zinc-800/50" />
        </div>
      </div>
    );
  }

  // Error state
  if (error && !intelligence) {
    return (
      <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-900/50 border border-red-700">
            <span className="text-red-300">⚠</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-300">Failed to Load Intelligence</h3>
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchIntelligence(true)}
          className="rounded bg-red-900/50 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-900/70 transition-colors border border-red-700/50"
        >
          Retry
        </button>
      </div>
    );
  }

  // No intelligence data
  if (!intelligence) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="text-center py-8">
          <p className="text-sm text-zinc-400">No intelligence data available</p>
          <p className="mt-1 text-xs text-zinc-500">Intelligence will be computed automatically</p>
        </div>
      </div>
    );
  }

  const canRecompute = isVerifier || isAdmin;

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-left"
          >
            <span className="text-zinc-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▶
            </span>
            <h3 className="text-sm font-semibold text-zinc-50">Decision Intelligence</h3>
          </button>
          <ConfidenceBadge
            score={intelligence.confidence_score}
            band={intelligence.confidence_band}
            explanationFactors={intelligence.explanation_factors}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Phase 7.4: Freshness indicator */}
          <FreshnessIndicator
            computedAt={intelligence.computed_at}
            isStale={intelligence.is_stale ?? false}
            staleAfterMinutes={intelligence.stale_after_minutes ?? 30}
          />

          {/* Recompute button (verifier/admin only) */}
          {canRecompute && (
            <button
              onClick={handleRecompute}
              disabled={recomputing}
              className="rounded bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-200 hover:bg-blue-900/70 transition-colors border border-blue-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {recomputing ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-transparent" />
                  Recomputing...
                </span>
              ) : (
                '↻ Recompute'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error message (if recompute failed but we have cached data) */}
      {error && intelligence && (
        <div className="rounded border border-red-700/50 bg-red-950/20 px-3 py-2">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Collapsible content */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Confidence badge (large version) */}
          <div className="flex items-center gap-2">
            <ConfidenceBadge
              score={intelligence.confidence_score}
              band={intelligence.confidence_band}
              explanationFactors={intelligence.explanation_factors}
              size="lg"
              showTooltip={true}
            />
            <span className="text-xs text-zinc-500">
              Based on {intelligence.explanation_factors.length} factors
            </span>
          </div>

          {/* Decision summary */}
          <DecisionSummaryCard
            narrative={intelligence.narrative}
            gaps={intelligence.gaps}
            biasFlags={intelligence.bias_flags}
            confidenceBand={intelligence.confidence_band}
            rulesTotal={intelligence.rules_total}
            rulesPassed={intelligence.rules_passed}
            failedRules={intelligence.failed_rules}
            computedAt={intelligence.computed_at}
            isStale={intelligence.is_stale}
            fieldChecksTotal={intelligence.field_checks_total}
            fieldChecksPassed={intelligence.field_checks_passed}
            confidenceRationale={intelligence.confidence_rationale}
          />

          {/* Phase 7.15: Field validation issues panel */}
          {(intelligence.field_checks_total ?? 0) > 0 && (
            <FieldIssuesPanel
              fieldIssues={intelligence.field_issues ?? []}
              fieldChecksTotal={intelligence.field_checks_total}
              fieldChecksPassed={intelligence.field_checks_passed}
            />
          )}

          {/* Phase 7.17: Confidence History Panel */}
          <ConfidenceHistoryPanel
            caseId={caseId}
            limit={10}
          />

          {/* Phase 7.9: Rules panel (shown first if rules exist) */}
          {(intelligence.rules_total ?? 0) > 0 && (
            <RulesPanel
              rulesTotal={intelligence.rules_total ?? 0}
              rulesPassed={intelligence.rules_passed ?? 0}
              failedRules={intelligence.failed_rules ?? []}
            />
          )}

          {/* Gaps panel */}
          <GapsPanel
            gaps={intelligence.gaps}
            gapSeverityScore={intelligence.gap_severity_score}
          />

          {/* Bias warnings panel */}
          <BiasWarningsPanel biasFlags={intelligence.bias_flags} />

          {/* Debug info (only for admin, collapsed by default) */}
          {isAdmin && intelligence.signals && (
            <details className="rounded border border-zinc-800 bg-zinc-900/50 p-2">
              <summary className="cursor-pointer text-xs font-medium text-zinc-400">
                Raw Signals ({intelligence.signals.length})
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-400">
                {JSON.stringify(intelligence.signals, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};
