import React, { useState } from "react";
import type { Gap } from "../../api/intelligenceApi";

interface GapsPanelProps {
  gaps: Gap[];
  gapSeverityScore: number;
}

interface NormalizedGap extends Gap {
  displayTitle: string;
  dedupeKey: string;
}

const severityConfig = {
  high: {
    bgClass: 'bg-red-900/20 border-red-800/50',
    textClass: 'text-red-300',
    badgeClass: 'bg-red-900/50 text-red-200 border-red-700',
    dotClass: 'bg-red-400',
  },
  medium: {
    bgClass: 'bg-amber-900/20 border-amber-800/50',
    textClass: 'text-amber-300',
    badgeClass: 'bg-amber-900/50 text-amber-200 border-amber-700',
    dotClass: 'bg-amber-400',
  },
  low: {
    bgClass: 'bg-yellow-900/20 border-yellow-800/50',
    textClass: 'text-yellow-300',
    badgeClass: 'bg-yellow-900/50 text-yellow-200 border-yellow-700',
    dotClass: 'bg-yellow-400',
  },
};

const gapTypeLabels: Record<string, string> = {
  missing: 'Missing Information',
  partial: 'Incomplete Evidence',
  weak: 'Weak Evidence',
  stale: 'Outdated Information',
};

const gapTypeIcons: Record<string, string> = {
  missing: '✗',
  partial: '◐',
  weak: '▽',
  stale: '⏱',
};

/**
 * Normalize and deduplicate gaps
 * - Filter out empty gaps (no description, affected_area, or expected_signal)
 * - Build displayTitle from description or construct from gap_type
 * - Deduplicate by severity|gap_type|displayTitle
 */
function normalizeGaps(gaps: Gap[]): NormalizedGap[] {
  const seen = new Set<string>();
  const normalized: NormalizedGap[] = [];

  for (const gap of gaps) {
    // Filter: keep only gaps with meaningful content
    const hasContent = (gap.description && gap.description.trim()) ||
                       (gap.affected_area && gap.affected_area.trim()) ||
                       (gap.expected_signal && gap.expected_signal.trim());
    
    if (!hasContent) continue;

    // Build displayTitle
    const displayTitle = gap.description?.trim() || 
                        `${gap.affected_area || gap.gap_type || 'gap'} (${gap.gap_type || 'unknown'})`;

    // Dedupe key
    const dedupeKey = `${gap.severity}|${gap.gap_type}|${displayTitle}`;
    
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    normalized.push({
      ...gap,
      displayTitle,
      dedupeKey,
    });
  }

  return normalized;
}

/**
 * GapsPanel Component
 * 
 * Displays information gaps detected in decision evidence with severity
 * levels and gap severity score meter.
 */
export const GapsPanel: React.FC<GapsPanelProps> = ({ gaps, gapSeverityScore }) => {
  // Normalize and deduplicate gaps
  const normalizedGaps = React.useMemo(() => normalizeGaps(gaps), [gaps]);

  // Track expanded state per severity
  const [expandedSeverities, setExpandedSeverities] = useState<Record<string, boolean>>({
    high: false,
    medium: false,
    low: false,
  });

  const toggleExpanded = (severity: string) => {
    setExpandedSeverities(prev => ({ ...prev, [severity]: !prev[severity] }));
  };

  if (normalizedGaps.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900/30 border border-emerald-700/50">
            <span className="text-sm">✓</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-50">No Information Gaps</h3>
            <p className="text-xs text-zinc-400">All expected evidence is present and complete</p>
          </div>
        </div>
      </div>
    );
  }

  // Group by severity
  const groupedBySeverity = React.useMemo(() => {
    const groups = { high: [] as NormalizedGap[], medium: [] as NormalizedGap[], low: [] as NormalizedGap[] };
    normalizedGaps.forEach(gap => {
      groups[gap.severity].push(gap);
    });
    return groups;
  }, [normalizedGaps]);

  // Group by type for summary
  const groupedByType = React.useMemo(() => {
    const groups: Record<string, number> = {};
    normalizedGaps.forEach(gap => {
      groups[gap.gap_type] = (groups[gap.gap_type] || 0) + 1;
    });
    return groups;
  }, [normalizedGaps]);

  const totalCount = normalizedGaps.length;
  const criticalCount = groupedBySeverity.high.length;

  // Gap severity score visualization
  const scoreColor = gapSeverityScore >= 60 ? 'red' : gapSeverityScore >= 30 ? 'amber' : 'yellow';
  const scoreColorClass = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    yellow: 'bg-yellow-500',
  }[scoreColor];

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-50">Information Gaps</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Missing or incomplete evidence affecting confidence
            </p>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="rounded-full border border-red-700 bg-red-900/50 px-2 py-0.5 text-[10px] font-medium text-red-200">
                {criticalCount} Critical
              </span>
            )}
            <span className="text-xs text-zinc-400">{totalCount} total</span>
          </div>
        </div>
      </div>

      {/* Gap severity score meter */}
      <div className="rounded border border-zinc-700/50 bg-zinc-900/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">Gap Severity Score</span>
          <span className="text-sm font-bold text-zinc-200">{gapSeverityScore}/100</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-all duration-500 ${scoreColorClass}`}
            style={{ width: `${Math.min(100, gapSeverityScore)}%` }}
          />
        </div>
        <div className="mt-1 text-[10px] text-zinc-500">
          {gapSeverityScore >= 60 && 'High severity - significant information missing'}
          {gapSeverityScore >= 30 && gapSeverityScore < 60 && 'Medium severity - some gaps present'}
          {gapSeverityScore < 30 && 'Low severity - minor gaps only'}
        </div>
      </div>

      {/* Gap type summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(groupedByType).map(([type, count]) => (
          <div
            key={type}
            className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900/70 px-2.5 py-1"
          >
            <span className="text-xs">{gapTypeIcons[type] || '•'}</span>
            <span className="text-xs font-medium text-zinc-300">
              {gapTypeLabels[type] || type}
            </span>
            <span className="text-xs text-zinc-500">×{count}</span>
          </div>
        ))}
      </div>

      {/* Gaps grouped by severity */}
      <div className="space-y-3">
        {(['high', 'medium', 'low'] as const).map(severity => {
          const gapsForSeverity = groupedBySeverity[severity];
          if (gapsForSeverity.length === 0) return null;

          const config = severityConfig[severity];
          const isExpanded = expandedSeverities[severity];
          const displayLimit = 8;
          const hasMore = gapsForSeverity.length > displayLimit;
          const displayedGaps = isExpanded ? gapsForSeverity : gapsForSeverity.slice(0, displayLimit);

          return (
            <div key={severity}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {severity} Priority ({gapsForSeverity.length})
                </h4>
              </div>
              <div className="space-y-2">
                {displayedGaps.map((gap, idx) => (
                  <div
                    key={gap.dedupeKey || idx}
                    className={`rounded-lg border p-3 ${config.bgClass}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{gapTypeIcons[gap.gap_type] || '•'}</span>
                          <span className={`text-xs font-semibold ${config.textClass}`}>
                            {gapTypeLabels[gap.gap_type] || gap.gap_type}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          {gap.displayTitle}
                        </div>
                        {gap.affected_area && gap.affected_area !== gap.displayTitle && (
                          <div className="mt-2 text-[10px] text-zinc-500">
                            Affected: <span className="font-mono text-zinc-400">{gap.affected_area}</span>
                          </div>
                        )}
                        {gap.expected_signal && (
                          <div className="mt-1 text-[10px] text-zinc-500">
                            Expected: <span className="font-mono text-zinc-400">{gap.expected_signal}</span>
                          </div>
                        )}
                      </div>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.badgeClass}`}>
                        {severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Show all / Show less toggle */}
                {hasMore && (
                  <button
                    onClick={() => toggleExpanded(severity)}
                    className="w-full rounded border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors"
                  >
                    {isExpanded ? (
                      <>Show less ({displayLimit} of {gapsForSeverity.length})</>
                    ) : (
                      <>Show all {gapsForSeverity.length} {severity} priority gaps</>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
