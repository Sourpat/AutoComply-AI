import React, { useState, useEffect } from "react";
import { getIntelligenceHistory } from "../../api/intelligenceApi";
import type { IntelligenceHistoryEntry } from "../../api/intelligenceApi";

interface ConfidenceHistoryPanelProps {
  caseId: string;
  limit?: number;
}

/**
 * ConfidenceHistoryPanel Component (Phase 7.17)
 * 
 * Displays a timeline of intelligence computation history for a case.
 * Shows what changed over time and what triggered each recomputation.
 * 
 * Features:
 * - Timeline of confidence changes
 * - Confidence score deltas (↑ +5% or ↓ -3%)
 * - Trigger badges (manual/submission/evidence/request_info)
 * - Expandable details (rules, gaps, bias counts)
 * - Empty state when no history exists
 */
export const ConfidenceHistoryPanel: React.FC<ConfidenceHistoryPanelProps> = ({
  caseId,
  limit = 10,
}) => {
  const [history, setHistory] = useState<IntelligenceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getIntelligenceHistory(caseId, limit);
        setHistory(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load history';
        setError(message);
        console.error('[ConfidenceHistoryPanel] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [caseId, limit]);

  // Calculate confidence delta between entries
  const getConfidenceDelta = (current: IntelligenceHistoryEntry, previous: IntelligenceHistoryEntry | null): number | null => {
    if (!previous) return null;
    return current.confidence_score - previous.confidence_score;
  };

  // Format delta with + or - sign
  const formatDelta = (delta: number | null): string => {
    if (delta === null) return '';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
  };

  // Get trigger badge color and label
  const getTriggerInfo = (trigger: string): { color: string; label: string; icon: string } => {
    switch (trigger) {
      case 'manual':
        return { color: 'bg-blue-900/40 text-blue-300 border-blue-700/50', label: 'Manual', icon: '👤' };
      case 'submission':
        return { color: 'bg-purple-900/40 text-purple-300 border-purple-700/50', label: 'Submission', icon: '📄' };
      case 'evidence':
        return { color: 'bg-green-900/40 text-green-300 border-green-700/50', label: 'Evidence', icon: '📎' };
      case 'request_info':
        return { color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50', label: 'Request Info', icon: '❓' };
      case 'decision':
        return { color: 'bg-orange-900/40 text-orange-300 border-orange-700/50', label: 'Decision', icon: '⚖️' };
      default:
        return { color: 'bg-zinc-900/40 text-zinc-400 border-zinc-700/50', label: 'Unknown', icon: '❔' };
    }
  };

  // Get confidence band color
  const getBandColor = (band: string): string => {
    switch (band) {
      case 'high':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  // Format timestamp as relative time
  const getRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
          Loading confidence history...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded border border-red-700/50 bg-red-950/20 p-3">
        <p className="text-xs text-red-300">{error}</p>
      </div>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="text-xs text-zinc-500">No intelligence history yet. History will appear after the first computation.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">Confidence History</span>
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* History timeline */}
      {isExpanded && (
        <div className="border-t border-zinc-800 p-3">
          <div className="space-y-2">
            {history.map((entry, index) => {
              const previous = index < history.length - 1 ? history[index + 1] : null;
              const delta = getConfidenceDelta(entry, previous);
              const triggerInfo = getTriggerInfo(entry.trigger);

              return (
                <div
                  key={index}
                  className="group relative rounded border border-zinc-800/50 bg-zinc-950/30 p-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50"
                >
                  {/* Timeline connector */}
                  {index < history.length - 1 && (
                    <div className="absolute -bottom-2 left-4 h-2 w-px bg-zinc-800" />
                  )}

                  {/* Header row: time + trigger */}
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-500">
                        {getRelativeTime(entry.computed_at)}
                      </span>
                      <span className="text-xs text-zinc-700">•</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${triggerInfo.color}`}>
                        {triggerInfo.icon} {triggerInfo.label}
                      </span>
                    </div>
                    {entry.actor_role !== 'system' && (
                      <span className="text-[10px] text-zinc-600">by {entry.actor_role}</span>
                    )}
                  </div>

                  {/* Confidence score with delta */}
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`text-lg font-semibold ${getBandColor(entry.confidence_band)}`}>
                      {entry.confidence_score.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      {entry.confidence_band}
                    </span>
                    {delta !== null && (
                      <span
                        className={`text-xs font-medium ${
                          delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'
                        }`}
                      >
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {formatDelta(delta)}
                      </span>
                    )}
                  </div>

                  {/* Metrics row */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    <span>
                      {entry.rules_passed}/{entry.rules_total} rules
                    </span>
                    {entry.gap_count > 0 && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span className="text-yellow-500/80">{entry.gap_count} gaps</span>
                      </>
                    )}
                    {entry.bias_count > 0 && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span className="text-red-500/80">{entry.bias_count} bias flags</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          {history.length >= limit && (
            <div className="mt-2 text-center">
              <p className="text-[10px] text-zinc-600">
                Showing last {limit} entries
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
