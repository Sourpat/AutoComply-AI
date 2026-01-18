import React from "react";
import type { BiasFlag } from "../../api/intelligenceApi";

interface BiasWarningsPanelProps {
  biasFlags: BiasFlag[];
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

const biasTypeLabels: Record<string, string> = {
  single_source_reliance: 'Single Source Reliance',
  low_diversity: 'Low Evidence Diversity',
  contradictions: 'Contradictory Evidence',
  stale_signals: 'Stale/Outdated Evidence',
};

const reviewActions: Record<string, string> = {
  single_source_reliance: 'Verify with additional independent sources',
  low_diversity: 'Request evidence from multiple different sources',
  contradictions: 'Investigate conflicting information and resolve discrepancies',
  stale_signals: 'Request updated documentation and current evidence',
};

/**
 * BiasWarningsPanel Component
 * 
 * Displays bias flags detected in decision evidence with severity levels
 * and suggested review actions.
 */
export const BiasWarningsPanel: React.FC<BiasWarningsPanelProps> = ({ biasFlags }) => {
  if (biasFlags.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-900/30 border border-emerald-700/50">
            <span className="text-sm">✓</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-50">No Bias Detected</h3>
            <p className="text-xs text-zinc-400">Evidence appears well-balanced and diverse</p>
          </div>
        </div>
      </div>
    );
  }

  // Group by severity
  const groupedBySeverity = React.useMemo(() => {
    const groups = { high: [] as BiasFlag[], medium: [] as BiasFlag[], low: [] as BiasFlag[] };
    biasFlags.forEach(flag => {
      groups[flag.severity].push(flag);
    });
    return groups;
  }, [biasFlags]);

  const totalCount = biasFlags.length;
  const criticalCount = groupedBySeverity.high.length;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-50">Bias & Quality Warnings</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Potential issues detected in evidence collection
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

      {/* Bias flags grouped by severity */}
      <div className="space-y-3">
        {(['high', 'medium', 'low'] as const).map(severity => {
          const flags = groupedBySeverity[severity];
          if (flags.length === 0) return null;

          const config = severityConfig[severity];

          return (
            <div key={severity}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {severity} Severity ({flags.length})
                </h4>
              </div>
              <div className="space-y-2">
                {flags.map((flag, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 ${config.bgClass}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className={`text-xs font-semibold ${config.textClass}`}>
                          {biasTypeLabels[flag.bias_type] || flag.bias_type}
                        </div>
                        <div className="mt-1 text-xs text-zinc-300">
                          {flag.description}
                        </div>
                      </div>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${config.badgeClass}`}>
                        {severity.toUpperCase()}
                      </span>
                    </div>

                    {/* Suggested review action */}
                    <div className="mt-2 rounded border border-zinc-700/30 bg-zinc-900/40 p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Suggested Action
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        {reviewActions[flag.bias_type] || 'Review evidence quality and completeness'}
                      </div>
                    </div>

                    {/* Affected signals (if provided) */}
                    {flag.affected_signals && flag.affected_signals.length > 0 && (
                      <div className="mt-2 border-t border-zinc-700/30 pt-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                          Affected Evidence
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {flag.affected_signals.slice(0, 5).map((signal, sidx) => (
                            <span
                              key={sidx}
                              className="rounded bg-zinc-800/50 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
                            >
                              {signal}
                            </span>
                          ))}
                          {flag.affected_signals.length > 5 && (
                            <span className="text-[10px] text-zinc-500">
                              +{flag.affected_signals.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
